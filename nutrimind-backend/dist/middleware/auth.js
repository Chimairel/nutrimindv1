"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_1 = require("@/lib/jwt");
/**
 * Express middleware to verify the access token from the Authorization header.
 * Attaches the decoded payload to req.user.
 */
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication token is required. Format: Bearer <token>',
            });
        }
        const token = authHeader.split(' ')[1];
        // Verify token using JWT helper
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        // Attach decoded user information to request object
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            error: error.message || 'Invalid or expired authentication session.',
        });
    }
};
exports.authenticate = authenticate;
exports.default = exports.authenticate;
//# sourceMappingURL=auth.js.map