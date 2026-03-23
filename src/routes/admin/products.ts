import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth';
import { productController } from '../../controllers/productController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Products
 *   description: Admin product management (requires x-admin-key header)
 */

/**
 * @swagger
 * /api/admin/createProduct:
 *   post:
 *     summary: Create a new product
 *     tags: [Admin - Products]
 *     security:
 *       - AdminKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barcode
 *               - name
 *               - categoryId
 *               - buyingPrice
 *               - sellingPrice
 *             properties:
 *               barcode:
 *                 type: string
 *                 example: "8901234567890"
 *               name:
 *                 type: string
 *                 example: "Baby Diapers Large"
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               buyingPrice:
 *                 type: number
 *                 example: 450
 *               sellingPrice:
 *                 type: number
 *                 example: 550
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/createProduct', adminAuth, productController.create);

/**
 * @swagger
 * /api/admin/editProduct/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Admin - Products]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sellingPrice:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.put('/editProduct/:id', adminAuth, productController.update);

/**
 * @swagger
 * /api/admin/deleteProduct/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Admin - Products]
 *     security:
 *       - AdminKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted successfully
 */
router.delete('/deleteProduct/:id', adminAuth, productController.delete);

export default router;