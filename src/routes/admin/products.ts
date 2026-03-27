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
 *         description: Search term (name, barcode, or slug)
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
 *                 description: Unique barcode number
 *               barcodeTitle:
 *                 type: string
 *                 example: "Pop Up Book"
 *                 description: Human-readable barcode title
 *               name:
 *                 type: string
 *                 example: "Baby Pop Up Book"
 *                 description: Product name
 *               description:
 *                 type: string
 *                 example: "<p>Product details with rich text formatting</p>"
 *                 description: Rich text product description
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *                 description: Category ID
 *               buyingPrice:
 *                 type: number
 *                 example: 200
 *                 description: Cost price
 *               sellingPrice:
 *                 type: number
 *                 example: 350
 *                 description: Selling price to customers
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product images (at least one required)
 *               videoUrl:
 *                 type: string
 *                 example: "https://youtube.com/watch?v=123"
 *                 description: Optional video URL
 *               forceOrderPriority:
 *                 type: integer
 *                 example: 5
 *                 description: Priority for force order (0 = disabled)
 *               discountPercent:
 *                 type: number
 *                 example: 10
 *                 description: Discount percentage (0 = no discount)
 *     responses:
 *       201:
 *         description: Product and barcode created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
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
 *                 example: "BAR9876543210"
 *                 description: New barcode number
 *               barcodeTitle:
 *                 type: string
 *                 example: "Updated Book Title"
 *                 description: New barcode title
 *               name:
 *                 type: string
 *                 example: "Updated Product Name"
 *                 description: Product name
 *               description:
 *                 type: string
 *                 example: "<p>Updated product details</p>"
 *                 description: Rich text product description
 *               sellingPrice:
 *                 type: number
 *                 example: 400
 *                 description: New selling price
 *               buyingPrice:
 *                 type: number
 *                 example: 250
 *                 description: New buying price
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New images (replaces existing)
 *               forceOrderPriority:
 *                 type: integer
 *                 example: 3
 *                 description: Force order priority (0 = disabled)
 *               discountPercent:
 *                 type: number
 *                 example: 15
 *                 description: Discount percentage (0 = no discount)
 *               categoryId:
 *                 type: integer
 *                 example: 2
 *                 description: New category ID
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
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
 *       400:
 *         description: Cannot delete product with sales records
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.delete('/delete/:id', adminAuth, productController.delete);

export default router;