import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import { stockMovementRouter, stockRouter } from './routes/stockRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import { stockMovementController, productMovementQuerySchema } from './controllers/stockMovementController.js';
import { authenticate } from './middleware/auth.js';
import { validateRequest } from './middleware/validate.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';

export const createApp = (): Express => {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: [ENV.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
    })
  );

  // Request Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'Shop Inventory Ledger API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  
  // Product details movement history: GET /api/products/:id/movements
  app.get(
    '/api/products/:id/movements',
    authenticate,
    validateRequest(productMovementQuerySchema),
    stockMovementController.getProductMovements
  );
  app.use('/api/products', productRoutes);

  app.use('/api/stock-movements', stockMovementRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/staff', staffRoutes);

  // 404 Route Handler
  app.all('*', (req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Cannot find endpoint ${req.method} ${req.originalUrl} on this server`, 404));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
