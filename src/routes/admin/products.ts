import { Router } from 'express';
import { productController } from '../../controllers/productController';
import { adminAuth } from '../../middleware/adminAuth';
import { uploadProductImages } from '../../multer';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Products
 *   description: Admin product management (requires Bearer token)
 */

/**
 * @swagger
 * /api/admin/products/getAll:
 *   get:
 *     summary: Get all products (admin view)
 *     tags: [Admin - Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: forceOrder
 *         schema:
 *           type: boolean
 *         description: Show only force order products
 *     responses:
 *       200:
 *         description: List of products with pagination
 */
router.get('/getAll', adminAuth, productController.getAllAdmin);

/**
 * @swagger
 * /api/admin/products/getById/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Admin - Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/getById/:id', adminAuth, productController.getById);

/**
 * @swagger
 * /api/admin/products/getByBarcode/{barcode}:
 *   get:
 *     summary: Get product by barcode
 *     tags: [Admin - Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/getByBarcode/:barcode', adminAuth, productController.getByBarcode);

/**
 * @swagger
 * /api/admin/products/create:
 *   post:
 *     summary: Create a new product with barcode
 *     tags: [Admin - Products]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - barcode
 *               - barcodeTitle
 *               - name
 *               - categoryId
 *               - buyingPrice
 *               - sellingPrice
 *               - images
 *             properties:
 *               barcode:
 *                 type: string
 *                 example: "BAR1234567890"
 *               barcodeTitle:
 *                 type: string
 *                 example: "Pop Up Book"
 *               name:
 *                 type: string
 *                 example: "Baby Pop Up Book"
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               buyingPrice:
 *                 type: number
 *                 example: 200
 *               sellingPrice:
 *                 type: number
 *                 example: 350
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               videoUrl:
 *                 type: string
 *               isForceOrder:
 *                 type: boolean
 *               forceOrderPriority:
 *                 type: integer
 *               hasDiscount:
 *                 type: boolean
 *               discountPercent:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Product and barcode created successfully
 */
router.post('/create', adminAuth, uploadProductImages, productController.create);

/**
 * @swagger
 * /api/admin/products/edit/{id}:
 *   put:
 *     summary: Update a product and its barcode
 *     tags: [Admin - Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               barcode:
 *                 type: string
 *               barcodeTitle:
 *                 type: string
 *               name:
 *                 type: string
 *               sellingPrice:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               stockQuantity:
 *                 type: integer
 *               isForceOrder:
 *                 type: boolean
 *               forceOrderPriority:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.put('/edit/:id', adminAuth, uploadProductImages, productController.update);

/**
 * @swagger
 * /api/admin/products/delete/{id}:
 *   delete:
 *     summary: Delete a product and its barcode
 *     tags: [Admin - Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product and barcode deleted successfully
 */
router.delete('/delete/:id', adminAuth, productController.delete);

export default router;