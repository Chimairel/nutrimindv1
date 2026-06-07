"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
/**
 * Express middleware factory to restrict routes to specific roles (USER, NUTRITIONIST, ADMIN).
 * Returns 403 Forbidden if the authenticated user's role is not authorized.
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
exports.default = exports.requireRole;
//# sourceMappingURL=rbac.js.map