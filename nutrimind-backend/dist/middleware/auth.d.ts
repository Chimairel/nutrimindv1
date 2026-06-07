import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';
/**
 * Express middleware to verify the access token from the Authorization header.
 * Attaches the decoded payload to req.user.
 */
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export default authenticate;
//# sourceMappingURL=auth.d.ts.map