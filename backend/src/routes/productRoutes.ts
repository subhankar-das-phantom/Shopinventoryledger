import { Router } from 'express';
import {
  productController,
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  productListQuerySchema
} from '../controllers/productController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

import { exportController } from '../controllers/exportController.js';

// All product routes require authentication
router.use(authenticate);

// Export products (Owner only) - Must be before /:id
router.get('/export', requireRole('OWNER'), exportController.exportProducts);

// Staff and Owner can view products
router.get('/', validateRequest(productListQuerySchema), productController.getProducts);
router.get('/:id', validateRequest(productIdParamSchema), productController.getProductById);

// Owner-only operations
router.post(
  '/',
  requireRole('OWNER'),
  validateRequest(createProductSchema),
  productController.createProduct
);

router.patch(
  '/:id',
  requireRole('OWNER'),
  validateRequest(updateProductSchema),
  productController.updateProduct
);

router.post(
  '/:id/deactivate',
  requireRole('OWNER'),
  validateRequest(productIdParamSchema),
  productController.deactivateProduct
);

export default router;
