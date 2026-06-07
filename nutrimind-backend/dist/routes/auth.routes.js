"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = __importDefault(require("@/controllers/auth.controller"));
const validate_1 = __importDefault(require("@/middleware/validate"));
const router = (0, express_1.Router)();
/**
 * Route: POST /api/auth/register
 * Description: Registers a new user. Enforces strict input validation rules.
 */
router.post('/register', [
    (0, express_validator_1.body)('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required.'),
    (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address.'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long.'),
    validate_1.default,
], auth_controller_1.default.register);
/**
 * Route: POST /api/auth/login
 * Description: Logs in an existing user.
 */
router.post('/login', [
    (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address.'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required.'),
    validate_1.default,
], auth_controller_1.default.login);
/**
 * Route: POST /api/auth/refresh
 * Description: Refreshes an expired access token using a valid refresh token.
 */
router.post('/refresh', auth_controller_1.default.refresh);
/**
 * Route: POST /api/auth/logout
 * Description: Logs out the current session.
 */
router.post('/logout', auth_controller_1.default.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map