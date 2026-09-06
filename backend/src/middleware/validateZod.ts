import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { sendApiError } from '@/lib/http-response';

type RequestLocation = 'body' | 'params' | 'query';
type RequestSchemas = Partial<Record<RequestLocation, ZodType>>;

export const validateZodRequest = (schemas: RequestSchemas) => (req: Request, res: Response, next: NextFunction) => {
  for (const location of ['params', 'query', 'body'] as const) {
    const schema = schemas[location];
    if (!schema) continue;
    const result = schema.safeParse(req[location] ?? {});
    if (!result.success) {
      return sendApiError(
        res,
        400,
        result.error.issues[0]?.message || `Invalid request ${location}.`,
        'VALIDATION_ERROR',
        {
          fields: result.error.issues.map((issue) => ({
            field: [location, ...issue.path].join('.'),
            message: issue.message,
          })),
        }
      );
    }
    req[location] = result.data;
  }
  next();
};

export const validateZodBody = (schema: ZodType) => validateZodRequest({ body: schema });

export default validateZodBody;
