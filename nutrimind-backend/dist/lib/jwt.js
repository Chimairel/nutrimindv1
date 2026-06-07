"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Load secrets safely from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('[JWT Library] 🛑 CRITICAL ERROR: JWT secrets are undefined in environment variables.');
}
/**
 * Signs a short-lived access token valid for 15 minutes.
 */
const signAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};
exports.signAccessToken = signAccessToken;
/**
 * Signs a long-lived refresh token valid for 7 days.
 */
const signRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};
exports.signRefreshToken = signRefreshToken;
/**
 * Verifies and decodes an access token.
 * Throws an error if invalid or expired.
 */
const verifyAccessToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new Error('Access token is invalid or expired.');
    }
};
exports.verifyAccessToken = verifyAccessToken;
/**
 * Verifies and decodes a refresh token.
 * Throws an error if invalid or expired.
 */
const verifyRefreshToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
    }
    catch (error) {
        throw new Error('Refresh token is invalid or expired.');
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwt.js.map