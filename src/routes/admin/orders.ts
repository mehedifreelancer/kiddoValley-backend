import { Router } from "express";
import { orderController } from "../../controllers/orderController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

/**
 * @swagger
 * /api/admin/orders/create:
 *   post:
 *     summary: Create a new order (sale)
 *     tags: [Admin - Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerName
 *               - customerPhone
 *               - customerAddress
 *               - items
 *               - subtotal
 *               - total
 *             properties:
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               customerPhone2:
 *                 type: string
 *               customerAddress:
 *                 type: string
 *               deliveryDate:
 *                 type: string
 *                 format: date
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     stockId:
 *                       type: integer
 *                     quantity:
 *                       type: integer
 *                     unitPrice:
 *                       type: number
 *                     totalPrice:
 *                       type: number
 *               subtotal:
 *                 type: number
 *               discountTotal:
 *                 type: number
 *               total:
 *                 type: number
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/create", adminAuth, orderController.createOrder);

export default router;
