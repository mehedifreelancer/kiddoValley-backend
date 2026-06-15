import { Router } from "express";
import { stockController } from "../../controllers/stockController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Stock
 *   description: Stock (batch) management (requires Bearer token)
 */

/**
 * @swagger
 * /api/admin/stock/check-sku:
 *   get:
 *     summary: Check if a variant SKU already exists
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sku
 *         required: true
 *         schema:
 *           type: string
 *         description: SKU to check
 *     responses:
 *       200:
 *         description: Returns an object with a boolean property "exists"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 exists:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/check-sku", adminAuth, stockController.checkSku);

/**
 * @swagger
 * /api/admin/stock/add:
 *   post:
 *     summary: Add a new stock batch (batch) to a variant
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variantId
 *               - batchNo
 *               - buyingOrMakingPrice
 *               - sellingPrice
 *               - quantity
 *             properties:
 *               variantId:
 *                 type: integer
 *                 example: 10
 *               batchNo:
 *                 type: string
 *                 example: "1"
 *               buyingOrMakingPrice:
 *                 type: number
 *                 example: 120
 *               sellingPrice:
 *                 type: number
 *                 example: 250
 *               discountPercent:
 *                 type: integer
 *                 example: 0
 *               quantity:
 *                 type: integer
 *                 example: 100
 *     responses:
 *       201:
 *         description: Stock batch created
 *       400:
 *         description: Missing fields or batch number already exists
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 */
router.post("/add", adminAuth, stockController.createStock);

/**
 * @swagger
 * /api/admin/stock/reduce:
 *   post:
 *     summary: Reduce stock from a specific batch (by stockId)
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stockId
 *               - quantity
 *             properties:
 *               stockId:
 *                 type: integer
 *                 example: 42
 *               quantity:
 *                 type: integer
 *                 example: 5
 *               reason:
 *                 type: string
 *                 example: "Sold via POS"
 *               saleId:
 *                 type: integer
 *                 description: Optional, if reduction is from a sale
 *     responses:
 *       200:
 *         description: Stock reduced successfully
 *       400:
 *         description: Invalid input or insufficient stock
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Stock not found
 */
router.post("/reduce", adminAuth, stockController.reduceStock);

/**
 * @swagger
 * /api/admin/stock/change-price:
 *   post:
 *     summary: Change selling price – creates a new batch (with incremented batch number)
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stockId
 *               - newSellingPrice
 *             properties:
 *               stockId:
 *                 type: integer
 *                 example: 42
 *               newSellingPrice:
 *                 type: number
 *                 example: 280
 *               newBuyingPrice:
 *                 type: number
 *                 example: 140
 *               reason:
 *                 type: string
 *                 example: "Price increase"
 *     responses:
 *       200:
 *         description: New batch created
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Stock not found
 */
router.post("/change-price", adminAuth, stockController.changeSellingPrice);

/**
 * @swagger
 * /api/admin/stock/variant/{variantId}:
 *   get:
 *     summary: Get all stock batches for a specific variant
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Variant ID
 *     responses:
 *       200:
 *         description: List of stock batches
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 */
router.get(
  "/variant/:variantId",
  adminAuth,
  stockController.getStocksByVariant,
);

/**
 * @swagger
 * /api/admin/stock/product/{productId}:
 *   get:
 *     summary: Get all stock batches for all variants of a product
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: List of stock batches
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/product/:productId",
  adminAuth,
  stockController.getStocksByProduct,
);

/**
 * @swagger
 * /api/admin/stock/nested-list:
 *   get:
 *     summary: Get nested stock list (Product → Variant → Batch)
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Nested stock tree
 *       401:
 *         description: Unauthorized
 */
router.get("/nested-list", adminAuth, stockController.getNestedStockList);

/**
 * @swagger
 * /api/admin/stock/list:
 *   get:
 *     summary: Simple product stock list (non‑nested, paginated)
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortStock
 *         schema:
 *           type: string
 *           enum: [low, high]
 *     responses:
 *       200:
 *         description: Filtered product list with total stock
 */
router.get("/list", adminAuth, stockController.getProductStockList);

/**
 * @swagger
 * /api/admin/stock/advanced-filter:
 *   get:
 *     summary: Advanced product filter with stock aggregates (legacy)
 *     tags: [Admin - Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: minSelling
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxSelling
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortStock
 *         schema:
 *           type: string
 *           enum: [low, high]
 *     responses:
 *       200:
 *         description: Filtered product list
 */
router.get("/advanced-filter", adminAuth, stockController.advancedFilter);
router.delete("/:id", adminAuth, stockController.deleteStock);
router.get("/flat-list", adminAuth, stockController.getFlatStockList);
export default router;
