import { Router } from 'express';
import { categoryController } from '../../controllers/categoryController';
import { adminAuth } from '../../middleware/adminAuth';

const router = Router();

// Admin only routes (protected)
router.post('/', adminAuth, categoryController.create);
router.put('/:id', adminAuth, categoryController.update);
router.delete('/:id', adminAuth, categoryController.delete);

export default router;