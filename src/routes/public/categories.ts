import { Router } from "express";
import { categoryController } from "../../controllers/categoryController";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Public - Categories
 *   description: Public category endpoints (no authentication)
 */

/**
 * @swagger
 * /api/public/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Public - Categories]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get("/categories", categoryController.getAll);

/**
 * @swagger
 * /api/public/category/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Public - Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
router.get("/category/:id", categoryController.getById);

/**
 * @swagger
 * /api/public/category/{slug}:
 *   get:
 *     summary: Get category by slug
 *     tags: [Public - Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
router.get("/category/:slug", categoryController.getBySlug);

export default router;
