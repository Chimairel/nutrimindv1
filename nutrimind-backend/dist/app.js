"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const rateLimiter_1 = require("@/middleware/rateLimiter");
const email_1 = require("@/lib/email");
// Import Routers
const auth_routes_1 = __importDefault(require("@/routes/auth.routes"));
const user_routes_1 = __importDefault(require("@/routes/user.routes"));
const nutritionist_routes_1 = __importDefault(require("@/routes/nutritionist.routes"));
const admin_routes_1 = __importDefault(require("@/routes/admin.routes"));
const fnri_routes_1 = __importDefault(require("@/routes/fnri.routes"));
const meals_routes_1 = __importDefault(require("@/routes/meals.routes"));
const grocery_routes_1 = __importDefault(require("@/routes/grocery.routes"));
const progress_routes_1 = __importDefault(require("@/routes/progress.routes"));
const cron_routes_1 = __importDefault(require("@/routes/cron.routes"));
// Initialize Express app
const app = (0, express_1.default)();
// Apply security and global middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use('/api', rateLimiter_1.apiLimiter); // Global API rate limit
// Verify email transporter on startup (non-blocking)
(0, email_1.verifyEmailTransporter)();
// Mount API Routers
app.use('/api/auth', auth_routes_1.default);
app.use('/api/user', user_routes_1.default);
app.use('/api/nutritionist', nutritionist_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/fnri', fnri_routes_1.default);
app.use('/api/user/meals', meals_routes_1.default);
app.use('/api/user/grocery', grocery_routes_1.default);
app.use('/api/user/progress', progress_routes_1.default);
app.use('/api/cron', cron_routes_1.default);
// Base health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'NutriMind API is running',
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map