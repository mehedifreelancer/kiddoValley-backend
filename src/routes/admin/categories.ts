import { Router } from 'express';
import { categoryController } from '../../controllers/categoryController';
import { adminAuth } from '../../middleware/adminAuth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Categories
 *   description: Admin category management (requires x-admin-key header)
 */

/**
 * @swagger
 * /api/admin/createCategory:
 *   post:
 *     summary: Create a new category
 *     tags: [Admin - Categories]
 *     security:
 *       - AdminKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Baby Products"
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post('/createCategory', adminAuth, categoryController.create);

/**
 * @swagger
 * /api/admin/editCategory/{id}:
 *   put:
 *     summary: Update a category
 *     tags: [Admin - Categories]
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
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Premium Baby Products"
 *     responses:
 *       200:
 *         description: Category updated successfully
 */
router.put('/editCategory/:id', adminAuth, categoryController.update);

/**
 * @swagger
 * /api/admin/deleteCategory/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Admin - Categories]
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
 *         description: Category deleted successfully
 */
router.delete('/deleteCategory/:id', adminAuth, categoryController.delete);

export default router;