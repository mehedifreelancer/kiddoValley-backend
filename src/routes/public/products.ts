import { Router } from "express";
import { productController } from "../../controllers/productController";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Public - Products
 *   description: Public product endpoints (no authentication)
 */

/**
 * @swagger
 * /api/public/products:
 *   get:
 *     summary: Get all products with pagination
 *     tags: [Public - Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: forceOrder
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of products with pagination
 */
router.get("/products", productController.getAllPublic);

/**
 * @swagger
 * /api/public/product/{slug}:
 *   get:
 *     summary: Get product by slug
 *     tags: [Public - Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get("/product/:slug", productController.getBySlug);

/**
 * @swagger
 * /api/public/products/force-order:
 *   get:
 *     summary: Get all force order products
 *     tags: [Public - Products]
 *     responses:
 *       200:
 *         description: List of force order products
 */
router.get("/products/force-order", productController.getForceOrder);
router.get("/products/related/:id", productController.getRelatedProducts);

export default router;
