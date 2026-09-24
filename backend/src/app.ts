import express, { Request, Response } from 'express';
import cors from 'cors';
import { createCorsOptions } from '@/config/cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiLimiter } from '@/middleware/rateLimiter';
import { verifyEmailTransporter } from '@/lib/email';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { env } from '@/config/env';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { logger } from '@/lib/logger';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '@/docs/openapi';

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
import nutritionistApplicationRouter from '@/routes/nutritionist-application.routes';

// Initialize Express app
const app = express();
// Personalized API responses must not turn into bodyless 304 responses during
// auth hydration or safety/profile refreshes.
app.disable('etag');
if (env.TRUST_PROXY) app.set('trust proxy', 1);

if (env.NODE_ENV !== 'production' || env.API_DOCS_ENABLED) {
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openApiDocument));
}

// Apply security and global middleware
app.use(helmet());
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.slice(0, 100) || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});
app.use(cors(createCorsOptions(env.allowedCorsOrigins)));
// Applicant media is bounded by its schema (1 MB headshot + 500 KB signature).
app.use('/api/nutritionist-applications', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use('/api', apiLimiter); // Global API rate limit

// SMTP verification is an explicit startup check because it opens an external
// connection. Email delivery remains available even when this check is disabled.
if (env.SMTP_VERIFY_ON_STARTUP) {
  void verifyEmailTransporter();
}

// Mount API Routers
app.use('/api/auth', authRouter);
// Specific progress routes own their read/write prerequisites; mount before the broader user router.
app.use('/api/user/progress', progressRouter);
app.use('/api/user', userRouter);
app.use('/api/nutritionist', nutritionistRouter);
app.use('/api/admin', adminRouter);
app.use('/api/fnri', fnriRouter);
app.use('/api/user/meals', mealsRouter);
app.use('/api/user/grocery', groceryRouter);
app.use('/api/cron', cronRouter);
app.use('/api/nutritionist-applications', nutritionistApplicationRouter);

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

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
