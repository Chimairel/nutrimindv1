import { RequestHandler, Response, Router } from 'express';
import { z } from 'zod';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '@/services/billing-checkout-boundary.service';
import { billingCheckoutBoundary } from '@/billing/runtime';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { requireReadyUser } from '@/middleware/userPrerequisites';
import validateZodBody from '@/middleware/validateZod';
import { AuthenticatedRequest } from '@/types';

const checkoutBodySchema = z.object({
  priceCode: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,63}$/, 'A valid price code is required.'),
}).strict();

function checkoutErrorStatus(code: CheckoutBoundaryError['code']): number {
  if (code === 'CHECKOUT_REQUEST_INVALID') return 400;
  if (code === 'CHECKOUT_PRICE_UNAVAILABLE') return 404;
  if (code === 'CHECKOUT_IDEMPOTENCY_CONFLICT') return 409;
  return 503;
}

export function createCheckoutHandler(service: BillingCheckoutBoundary): RequestHandler {
  return async (request: AuthenticatedRequest, response: Response) => {
    try {
      const idempotencyHeader = request.header('idempotency-key');
      if (!request.user?.userId || !idempotencyHeader) {
        return response.status(400).json({
          success: false,
          error: 'A valid checkout request is required.',
          errorCode: 'CHECKOUT_REQUEST_INVALID',
        });
      }
      const session = await service.create({
        userId: request.user.userId,
        priceCode: request.body.priceCode,
        requestIdempotencyKey: idempotencyHeader,
      });
      return response.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      const code = error instanceof CheckoutBoundaryError
        ? error.code
        : 'CHECKOUT_TEMPORARILY_UNAVAILABLE';
      return response.status(checkoutErrorStatus(code)).json({
        success: false,
        error: code === 'PAYMENTS_UNAVAILABLE'
          ? 'Payments are currently unavailable.'
          : 'Checkout is currently unavailable.',
        errorCode: code,
      });
    }
  };
}

export function createBillingRouter(input: {
  checkoutService: BillingCheckoutBoundary;
  authenticate?: RequestHandler;
  authorizeUser?: RequestHandler;
  requirePrerequisites?: RequestHandler;
}): Router {
  const router = Router();
  router.use(input.authenticate || authenticate);
  router.use(input.authorizeUser || requireRole('USER'));
  router.use(input.requirePrerequisites || requireReadyUser);
  router.post('/subscriptions', validateZodBody(checkoutBodySchema), createCheckoutHandler(input.checkoutService));
  return router;
}

export default createBillingRouter({ checkoutService: billingCheckoutBoundary });
