"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = __importDefault(require("@/services/auth.service"));
class AuthController {
    /**
     * Endpoint handler to register a new user account.
     */
    static async register(req, res) {
        try {
            const { name, email, password } = req.body;
            const result = await auth_service_1.default.register(name, email, password);
            return res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to complete registration.',
            });
        }
    }
    /**
     * Endpoint handler to authenticate and log in a user.
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.default.login(email, password);
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to authenticate session.',
            });
        }
    }
    /**
     * Endpoint handler to verify and refresh an access token.
     */
    static async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token is required.',
                });
            }
            const result = await auth_service_1.default.refreshToken(refreshToken);
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                error: error.message || 'Invalid or expired session refresh.',
            });
        }
    }
    /**
     * Endpoint handler to securely log out a session.
     */
    static async logout(req, res) {
        // Session state cookies are cleared client side.
        // Return standard success template
        return res.status(200).json({
            success: true,
            data: { message: 'Logged out successfully.' },
        });
    }
}
exports.AuthController = AuthController;
exports.default = AuthController;
//# sourceMappingURL=auth.controller.js.map