import type { CorsOptions } from 'cors';
import { AppError } from '@/errors/AppError';

export function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }
      callback(
        new AppError(
          'This website address is not allowed to access the API. Add its exact origin to the backend CORS_ORIGINS configuration and restart the backend.',
          403,
          'ORIGIN_NOT_ALLOWED'
        )
      );
    },
    credentials: true,
  };
}
