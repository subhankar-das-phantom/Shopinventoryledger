import { Router } from 'express';
import {
  staffController,
  createStaffSchema,
  updateStaffSchema
} from '../controllers/staffController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

// All staff routes require OWNER role
router.use(authenticate, requireRole('OWNER'));

router.get('/', staffController.getStaffList);
router.post('/', validateRequest(createStaffSchema), staffController.createStaff);
router.patch('/:id', validateRequest(updateStaffSchema), staffController.updateStaff);

export default router;
