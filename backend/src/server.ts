import dotenv from 'dotenv';
// Load environment variables as early as possible
dotenv.config();

import app from './app';
import { assertProductionConfig } from '@/domain/production-config.policy';

const PORT = process.env.PORT || 5000;

assertProductionConfig(process.env);

const server = app.listen(PORT, () => {
  console.log(`[Server] NutriMind API server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Process terminated.');
  });
});
