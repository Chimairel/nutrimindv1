import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiLimiter } from '@/middleware/rateLimiter';
import { verifyEmailTransporter } from '@/lib/email';

// Import Routers
import authRouter from '@/routes/auth.routes';
import userRouter from '@/routes/user.routes';
import nutritionistRouter from '@/routes/nutritionist.routes';
import adminRouter from '@/routes/admin.routes';
import fnriRouter from '@/routes/fnri.routes';
import mealsRouter from '@/routes/meals.routes';
import groceryRouter from '@/routes/grocery.routes';
import progressRouter from '@/routes/progress.routes';
import cronRouter from '@/routes/cron.routes';

// Initialize Express app
const app = express();

// Apply security and global middleware
app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiLimiter); // Global API rate limit

// Verify email transporter on startup (non-blocking)
verifyEmailTransporter();

// Mount API Routers
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/nutritionist', nutritionistRouter);
app.use('/api/admin', adminRouter);
app.use('/api/fnri', fnriRouter);
app.use('/api/user/meals', mealsRouter);
app.use('/api/user/grocery', groceryRouter);
app.use('/api/user/progress', progressRouter);
app.use('/api/cron', cronRouter);

// Base health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'NutriMind API is running',
  });
});

export default app;

