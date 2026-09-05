import express, { ErrorRequestHandler, RequestHandler, Response, Router } from 'express';
import { paymongoWebhookBoundary } from '@/billing/runtime';
import { PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES } from '@/domain/paymongo-config.policy';
import { PaymongoWebhookBoundary, WebhookBoundaryError } from '@/services/paymongo-webhook-boundary.service';

export const paymongoRawBodyParser = express.raw({
  type: 'application/json',
  limit: PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES,
});

export const paymongoRawBodyErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  const type = error && typeof error === 'object' ? (error as { type?: string }).type : undefined;
  if (type === 'entity.too.large') {
    return response.status(413).json({ success: false, error: 'Webhook body is too large.', errorCode: 'WEBHOOK_BODY_TOO_LARGE' });
  }
  if (error) {
    return response.status(400).json({ success: false, error: 'Webhook body is invalid.', errorCode: 'WEBHOOK_BODY_INVALID' });
  }
  return next();
};

function webhookErrorStatus(code: WebhookBoundaryError['code']): number {
  if (code === 'WEBHOOK_SIGNATURE_INVALID' || code === 'WEBHOOK_SIGNATURE_STALE') return 401;
  if (code === 'WEBHOOK_BODY_INVALID' || code === 'WEBHOOK_ENVIRONMENT_MISMATCH') return 400;
  if (code === 'WEBHOOK_EVENT_CONFLICT') return 409;
  return 503;
}

export function createPaymongoWebhookHandler(service: PaymongoWebhookBoundary): RequestHandler {
  return async (request, response: Response) => {
    const contentType = request.header('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return response.status(415).json({ success: false, error: 'Webhook content type is unsupported.', errorCode: 'WEBHOOK_CONTENT_TYPE_INVALID' });
    }
    const signature = request.header('paymongo-signature');
    if (!signature || !Buffer.isBuffer(request.body)) {
      return response.status(401).json({ success: false, error: 'Webhook authentication failed.', errorCode: 'WEBHOOK_SIGNATURE_INVALID' });
    }
    try {
      const result = await service.ingest(request.body, signature);
      if (result.decision === 'DUPLICATE') {
        return response.status(200).json({ success: true, status: 'DUPLICATE', entitlementGranted: false });
      }
      return response.status(202).json({
        success: true,
        status: result.knownEvent && result.decision !== 'OUT_OF_ORDER' ? 'ACCEPTED_PENDING' : 'QUARANTINED',
        entitlementGranted: false,
      });
    } catch (error) {
      const code = error instanceof WebhookBoundaryError ? error.code : 'WEBHOOK_INGESTION_UNAVAILABLE';
      return response.status(webhookErrorStatus(code)).json({
        success: false,
        error: code.startsWith('WEBHOOK_SIGNATURE') ? 'Webhook authentication failed.' : 'Webhook could not be accepted.',
        errorCode: code,
      });
    }
  };
}

export function createPaymongoWebhookRouter(service: PaymongoWebhookBoundary): Router {
  const router = Router();
  router.post('/', paymongoRawBodyParser, paymongoRawBodyErrorHandler, createPaymongoWebhookHandler(service));
  return router;
}

export default createPaymongoWebhookRouter(paymongoWebhookBoundary);
