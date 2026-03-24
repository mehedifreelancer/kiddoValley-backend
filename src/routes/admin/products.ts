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
 * /api/admin/products:
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
router.get('/products', adminAuth, productController.getAllAdmin);

/**
 * @swagger
 * /api/admin/product/{id}:
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
router.get('/product/:id', adminAuth, productController.getById);

/**
 * @swagger
 * /api/admin/product/barcode/{barcode}:
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
router.get('/product/barcode/:barcode', adminAuth, productController.getByBarcode);

/**
 * @swagger
 * /api/admin/createProduct:
 *   post:
 *     summary: Create a new product with images
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
 *               - name
 *               - categoryId
 *               - buyingPrice
 *               - sellingPrice
 *               - images
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
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product images (at least one)
 *               videoUrl:
 *                 type: string
 *                 example: "https://youtube.com/watch?v=123"
 *               isForceOrder:
 *                 type: boolean
 *                 default: false
 *               forceOrderPriority:
 *                 type: integer
 *                 default: 0
 *               hasDiscount:
 *                 type: boolean
 *                 default: false
 *               discountPercent:
 *                 type: number
 *               stockQuantity:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin privileges required
 */
router.post('/createProduct', adminAuth, uploadProductImages, productController.create);
/**
 * @swagger
 * /api/admin/editProduct/{id}:
 *   put:
 *     summary: Update a product (with optional image upload)
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
 *               name:
 *                 type: string
 *                 example: "Updated Product Name"
 *               sellingPrice:
 *                 type: number
 *                 example: 600
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New images (replaces existing)
 *               stockQuantity:
 *                 type: integer
 *                 example: 150
 *               isForceOrder:
 *                 type: boolean
 *               forceOrderPriority:
 *                 type: integer
 *               hasDiscount:
 *                 type: boolean
 *               discountPercent:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: Product not found
 */
router.put('/editProduct/:id', adminAuth, uploadProductImages, productController.update);

/**
 * @swagger
 * /api/admin/deleteProduct/{id}:
 *   delete:
 *     summary: Delete a product
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
 *         description: Product deleted successfully
 *       400:
 *         description: Cannot delete product with sales records
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: Product not found
 */
router.delete('/deleteProduct/:id', adminAuth, productController.delete);

export default router;