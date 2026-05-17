import { Router } from "express";
import { manufactureController } from "../../controllers/manufactureController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Manufactures
 *   description: Manufacturing cost & batch management (requires Bearer token)
 */

/**
 * @swagger
 * /api/admin/manufactures/create:
 *   post:
 *     summary: Create a new manufacture record (and automatically create stock batch)
 *     tags: [Admin - Manufactures]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - totalQuantity
 *               - costComponents
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 1
 *               variantId:
 *                 type: integer
 *                 description: Optional variant ID if the manufacture is for a specific variant
 *               totalQuantity:
 *                 type: integer
 *                 example: 5000
 *               costComponents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     cost:
 *                       type: number
 *                 example: [{"name":"Raw Materials","cost":900000},{"name":"Labor","cost":200000}]
 *               notes:
 *                 type: string
 *                 example: "March 2025 production"
 *               manufactureDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Manufacture and stock batch created
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.post("/create", adminAuth, manufactureController.create);

/**
 * @swagger
 * /api/admin/manufactures:
 *   get:
 *     summary: Get all manufacture records (with optional filters)
 *     tags: [Admin - Manufactures]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: variantId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of manufactures
 *       401:
 *         description: Unauthorized
 */
router.get("/", adminAuth, manufactureController.getAll);

/**
 * @swagger
 * /api/admin/manufactures/{id}:
 *   get:
 *     summary: Get a single manufacture by ID
 *     tags: [Admin - Manufactures]
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
 *         description: Manufacture details
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:id", adminAuth, manufactureController.getById);

/**
 * @swagger
 * /api/admin/manufactures/{id}:
 *   put:
 *     summary: Update manufacture details (totalQuantity, costComponents, notes)
 *     tags: [Admin - Manufactures]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalQuantity:
 *                 type: integer
 *               costComponents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     cost:
 *                       type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Manufacture updated
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 */
router.put("/:id", adminAuth, manufactureController.update);

/**
 * @swagger
 * /api/admin/manufactures/{id}:
 *   delete:
 *     summary: Delete a manufacture (only if no stock remains)
 *     tags: [Admin - Manufactures]
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
 *         description: Manufacture and associated stock deleted
 *       400:
 *         description: Cannot delete because stock still exists
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", adminAuth, manufactureController.delete);

export default router;
