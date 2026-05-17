import { Router } from "express";
import { attributeController } from "../../controllers/attributeController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Attributes
 *   description: Manage product attributes (dynamic variant attributes) – requires Bearer token
 */

/**
 * @swagger
 * /api/admin/attributes:
 *   get:
 *     summary: Get all product attributes
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of attributes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       values:
 *                         type: array
 *                         items:
 *                           type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get("/", adminAuth, attributeController.getAll);

/**
 * @swagger
 * /api/admin/attributes/id/{id}:
 *   get:
 *     summary: Get a single attribute by its numeric ID
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attribute ID
 *     responses:
 *       200:
 *         description: Attribute details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     values:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Attribute not found
 *       401:
 *         description: Unauthorized
 */
router.get("/id/:id", adminAuth, attributeController.getById);

/**
 * @swagger
 * /api/admin/attributes/name/{name}:
 *   get:
 *     summary: Get a single attribute by name (legacy)
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Attribute name (e.g., "Color")
 *     responses:
 *       200:
 *         description: Attribute details
 *       404:
 *         description: Attribute not found
 *       401:
 *         description: Unauthorized
 */
router.get("/name/:name", adminAuth, attributeController.getByName);

/**
 * @swagger
 * /api/admin/attributes:
 *   post:
 *     summary: Create a new product attribute
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - values
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Material"
 *               values:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Cotton", "Polyester", "Wool"]
 *     responses:
 *       201:
 *         description: Attribute created
 *       400:
 *         description: Invalid input or missing fields
 *       409:
 *         description: Attribute already exists
 *       401:
 *         description: Unauthorized
 */
router.post("/", adminAuth, attributeController.create);

/**
 * @swagger
 * /api/admin/attributes/{id}:
 *   put:
 *     summary: Update an attribute (rename or replace values) by ID
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attribute ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newName:
 *                 type: string
 *                 description: New name (optional)
 *               values:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Complete array of values (replaces existing)
 *     responses:
 *       200:
 *         description: Attribute updated
 *       404:
 *         description: Attribute not found
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.put("/:id", adminAuth, attributeController.update);

/**
 * @swagger
 * /api/admin/attributes/{id}/add-value:
 *   post:
 *     summary: Add a single new value to an existing attribute (by ID)
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attribute ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newValue
 *             properties:
 *               newValue:
 *                 type: string
 *                 example: "Viscose"
 *     responses:
 *       200:
 *         description: Value added successfully
 *       400:
 *         description: Missing newValue or invalid ID
 *       404:
 *         description: Attribute not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/add-value", adminAuth, attributeController.addValue);

/**
 * @swagger
 * /api/admin/attributes/{id}:
 *   delete:
 *     summary: Delete an attribute by ID
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attribute ID
 *     responses:
 *       200:
 *         description: Attribute deleted
 *       404:
 *         description: Attribute not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", adminAuth, attributeController.delete);

// ========== LEGACY ROUTES (by name, for backward compatibility) ==========
/**
 * @swagger
 * /api/admin/attributes/name/{name}:
 *   put:
 *     summary: Update an attribute by name (legacy)
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newName:
 *                 type: string
 *               values:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Attribute updated
 *       404:
 *         description: Attribute not found
 */
router.put("/name/:name", adminAuth, attributeController.update);

/**
 * @swagger
 * /api/admin/attributes/name/{name}/add-value:
 *   post:
 *     summary: Add a value by attribute name (legacy)
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newValue
 *             properties:
 *               newValue:
 *                 type: string
 *     responses:
 *       200:
 *         description: Value added
 *       404:
 *         description: Attribute not found
 */
router.post("/name/:name/add-value", adminAuth, attributeController.addValue);

/**
 * @swagger
 * /api/admin/attributes/name/{name}:
 *   delete:
 *     summary: Delete an attribute by name (legacy)
 *     tags: [Admin - Attributes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attribute deleted
 *       404:
 *         description: Attribute not found
 */
router.delete("/name/:name", adminAuth, attributeController.delete);

export default router;
