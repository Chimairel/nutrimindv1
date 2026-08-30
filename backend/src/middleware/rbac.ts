import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, Role } from '@/types';

/**
 * Express middleware factory to restrict routes to specific roles (USER, NUTRITIONIST, ADMIN).
 * Returns 403 Forbidden if the authenticated user's role is not authorized.
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Safety check: ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication is required before verifying authorization bounds.',
      });
    }

    const hasRole = allowedRoles.includes(req.user.role);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Your account role [${req.user.role}] is not authorized to access this resource.`,
      });
    }

    next();
  };
};

export default requireRole;
