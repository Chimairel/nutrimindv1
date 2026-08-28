import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

export const validateZodBody = (schema: ZodType) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error.issues[0]?.message || 'Invalid request body.',
      errorCode: 'VALIDATION_ERROR',
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
