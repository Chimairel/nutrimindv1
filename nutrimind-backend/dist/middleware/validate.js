"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const express_validator_1 = require("express-validator");
/**
 * Express middleware to validate request bodies and parameters using express-validator.
 * Formats errors into the standard response pattern: { success: false, error: '...' }
 */
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
exports.validate = validate;
exports.default = exports.validate;
//# sourceMappingURL=validate.js.map