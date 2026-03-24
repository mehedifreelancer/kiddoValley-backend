import { Router } from 'express';
import { categoryController } from '../../controllers/categoryController';
import { adminAuth } from '../../middleware/adminAuth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Categories
 *   description: Admin category management (requires Bearer token)
 */

/**
 * @swagger
 * /api/admin/createCategory:
 *   post:
 *     summary: Create a new category
 *     tags: [Admin - Categories]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryDto'
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input or category already exists
 *       401:
 *         description: Unauthorized - No token provided
 *       403:
 *         description: Forbidden - Admin privileges required
 */
router.post('/createCategory', adminAuth, categoryController.create);

/**
 * @swagger
 * /api/admin/editCategory/{id}:
 *   put:
 *     summary: Update a category
 *     tags: [Admin - Categories]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategoryDto'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: Category not found
 */
router.put('/editCategory/:id', adminAuth, categoryController.update);

/**
 * @swagger
 * /api/admin/deleteCategory/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Admin - Categories]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category with products
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: Category not found
 */
router.delete('/deleteCategory/:id', adminAuth, categoryController.delete);

export default router;