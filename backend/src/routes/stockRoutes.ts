import { Router } from 'express';
import {
  stockMovementController,
  baseMovementSchema,
  adjustmentSchema,
  movementListQuerySchema,
  productMovementQuerySchema
} from '../controllers/stockMovementController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { productIdParamSchema } from '../controllers/productController.js';

export const stockMovementRouter = Router();
export const stockRouter = Router();

// All movement and stock routes require authentication
stockMovementRouter.use(authenticate);
stockRouter.use(authenticate);

// === Stock Movements Routes ===

// Sale: Staff & Owner
stockMovementRouter.post(
  '/sale',
  validateRequest(baseMovementSchema),
  stockMovementController.recordSale
);

// Return: Staff & Owner
stockMovementRouter.post(
  '/return',
  validateRequest(baseMovementSchema),
  stockMovementController.recordReturn
);

// Purchase: Owner only
stockMovementRouter.post(
  '/purchase',
  requireRole('OWNER'),
  validateRequest(baseMovementSchema),
  stockMovementController.recordPurchase
);

// Adjustment: Owner only
stockMovementRouter.post(
  '/adjustment',
  requireRole('OWNER'),
  validateRequest(adjustmentSchema),
  stockMovementController.recordAdjustment
);

// Bounded list of all movements with filters
stockMovementRouter.get(
  '/',
  validateRequest(movementListQuerySchema),
  stockMovementController.getMovements
);

// === Stock Utility & Reports Routes ===

// Low stock list: Staff & Owner
stockRouter.get('/low-stock', stockMovementController.getLowStock);

// CSV stock report: Owner only
stockRouter.get(
  '/report.csv',
  requireRole('OWNER'),
  stockMovementController.exportCsvReport
);

// Parity verification: Owner only
stockRouter.get(
  '/verify-parity/:id',
  requireRole('OWNER'),
  validateRequest(productIdParamSchema),
  stockMovementController.verifyParity
);
