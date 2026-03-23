import { Router } from 'express';
import { categoryController } from '../../controllers/categoryController';

const router = Router();

// Public routes (no auth required)
router.get('/', categoryController.getAll);
router.get('/:id', categoryController.getById);
router.get('/slug/:slug', categoryController.getBySlug);

export default router;