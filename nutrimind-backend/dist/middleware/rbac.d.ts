import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, Role } from '@/types';
/**
 * Express middleware factory to restrict routes to specific roles (USER, NUTRITIONIST, ADMIN).
 * Returns 403 Forbidden if the authenticated user's role is not authorized.
 */
export declare const requireRole: (...allowedRoles: Role[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export default requireRole;
//# sourceMappingURL=rbac.d.ts.map