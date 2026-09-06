import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendApiError } from '@/lib/http-response';

/**
 * Express middleware to validate request bodies and parameters using express-validator.
 * Formats errors into the standard response pattern: { success: false, error: '...' }
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Map individual errors into a combined readable list string
    const errorMessage = errors
      .array()
      .map((err) => `${err.msg}`)
      .join(' | ');

    return sendApiError(res, 400, errorMessage || 'Validation failed for request inputs.', 'VALIDATION_ERROR');
  }

  next();
};

export default validate;
