import { Router } from 'express';
import { barcodeController } from '../../controllers/barcodeController';
import { adminAuth } from '../../middleware/adminAuth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Barcodes
 *   description: Barcode listing (CRUD handled by product controller)
 */

/**
 * @swagger
 * /api/admin/barcodes/getAll:
 *   get:
 *     summary: Get all barcodes with pagination
 *     tags: [Admin - Barcodes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title or barcode number
 *     responses:
 *       200:
 *         description: List of barcodes with pagination
 */
router.get('/getAll', adminAuth, barcodeController.getAll);

export default router;