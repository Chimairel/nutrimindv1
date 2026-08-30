import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

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

    return res.status(400).json({
      success: false,
      error: errorMessage || 'Validation failed for request inputs.',
    });
  }

  next();
};

export default validate;
