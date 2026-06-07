import { Request, Response, NextFunction } from 'express';
/**
 * Express middleware to validate request bodies and parameters using express-validator.
 * Formats errors into the standard response pattern: { success: false, error: '...' }
 */
export declare const validate: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export default validate;
//# sourceMappingURL=validate.d.ts.map