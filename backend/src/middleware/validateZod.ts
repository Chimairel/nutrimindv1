import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { sendApiError } from '@/lib/http-response';

export const validateZodBody = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    return sendApiError(res, 400, result.error.issues[0]?.message || 'Invalid request body.', 'VALIDATION_ERROR', {
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    });
  }

  req.body = result.data;
  next();
};

export default validateZodBody;
