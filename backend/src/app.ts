import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiLimiter } from '@/middleware/rateLimiter';
import { verifyEmailTransporter } from '@/lib/email';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';

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
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

const configuredCorsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedCorsOrigins = configuredCorsOrigins.length > 0
  ? configuredCorsOrigins
  : process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:3001'];

// Apply security and global middleware
app.use(helmet());
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.slice(0, 100) || randomUUID();
  res.setHeader('x-request-id', requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      type: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header are server-to-server or same-origin.
      if (!origin || allowedCorsOrigins.includes(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use('/api', apiLimiter); // Global API rate limit

// SMTP verification is an explicit startup check because it opens an external
// connection. Email delivery remains available even when this check is disabled.
if (process.env.SMTP_VERIFY_ON_STARTUP === 'true') {
  void verifyEmailTransporter();
}

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

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ success: true, message: 'NutriMind API is ready' });
  } catch {
    return res.status(503).json({ success: false, message: 'NutriMind API is not ready' });
  }
});

export default app;

