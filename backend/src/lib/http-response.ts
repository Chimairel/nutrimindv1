import { Response } from 'express';

export interface ApiErrorPayload {
  success: false;
  error: string;
  errorCode: string;
  requestId?: string;
  fields?: Array<{ field: string; message: string }>;
}

export function sendApiError(
  res: Response,
  statusCode: number,
  error: string,
  errorCode: string,
  extra: Pick<ApiErrorPayload, 'fields'> = {}
): Response<ApiErrorPayload> {
  return res.status(statusCode).json({
    success: false,
    error,
    errorCode,
    requestId: res.locals.requestId,
    ...extra,
  });
}
