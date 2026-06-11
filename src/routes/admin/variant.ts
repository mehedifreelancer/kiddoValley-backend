import { Router } from "express";
import { variantController } from "../../controllers/variantController";
import { adminAuth } from "../../middleware/adminAuth";
import { upload } from "../../multer";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Variant
 *   description: Product variant management (requires Bearer token)
 */

/**
 * @swagger
 * /api/admin/variant/create:
 *   post:
 *     summary: Create a new variant (with optional images and optional initial stock)
 *     tags: [Admin - Variant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - attributes
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 10
 *               attributes:
 *                 type: string
 *                 description: JSON string of attributes, e.g. {"color":"Red"}
 *               barcode:
 *                 type: string
 *                 description: Optional unique barcode for this variant
 *                 example: "8901234567890"
 *               isImported:
 *                 type: boolean
 *                 example: false
 *               countryOfOrigin:
 *                 type: string
 *                 example: "BD"
 *               buyingPrice:
 *                 type: number
 *                 description: Optional initial buying price
 *               sellingPrice:
 *                 type: number
 *                 description: Optional initial selling price
 *               discountPercent:
 *                 type: integer
 *                 description: Optional initial discount
 *               initialQuantity:
 *                 type: integer
 *                 description: Optional initial stock quantity
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 3 variant images
 *     responses:
 *       201:
 *         description: Variant created (and optional initial stock batch)
 *       400:
 *         description: Missing fields or SKU/barcode already exists
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.post(
  "/create",
  adminAuth,
  upload.array("images", 3),
  variantController.create,
);

/**
 * @swagger
 * /api/admin/variant/create-default:
 *   post:
 *     summary: Create a default variant (no attributes) for a product
 *     tags: [Admin - Variant]
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
 *             properties:
 *               productId:
 *                 type: integer
 *               barcode:
 *                 type: string
 *                 description: Optional barcode for the default variant
 *               isImported:
 *                 type: boolean
 *               countryOfOrigin:
 *                 type: string
 *     responses:
 *       201:
 *         description: Default variant created
 *       400:
 *         description: Product ID missing or variant already exists
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.post("/create-default", adminAuth, variantController.createDefault);

/**
 * @swagger
 * /api/admin/variant/{id}:
 *   get:
 *     summary: Get a single variant by ID (includes stocks)
 *     tags: [Admin - Variant]
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
 *         description: Variant details
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
 *                     sku:
 *                       type: string
 *                     barcode:
 *                       type: string
 *                     attributes:
 *                       type: object
 *                     images:
 *                       type: array
 *                     isImported:
 *                       type: boolean
 *                     countryOfOrigin:
 *                       type: string
 *                     stocks:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 */
router.get("/:id", adminAuth, variantController.getOne);

/**
 * @swagger
 * /api/admin/variant/product/{productId}:
 *   get:
 *     summary: Get all variants of a product (including their stock batches)
 *     tags: [Admin - Variant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of variants with their stocks
 *       401:
 *         description: Unauthorized
 */
router.get("/product/:productId", adminAuth, variantController.getByProduct);

/**
 * @swagger
 * /api/admin/variant/{id}:
 *   put:
 *     summary: Update a variant (attributes, imported flag, country, barcode, and images)
 *     tags: [Admin - Variant]
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
 *               attributes:
 *                 type: string
 *                 description: JSON string of attributes
 *               barcode:
 *                 type: string
 *                 description: New barcode (must be unique)
 *               isImported:
 *                 type: boolean
 *               countryOfOrigin:
 *                 type: string
 *               existingImages:
 *                 type: string
 *                 description: JSON string array of existing image objects (e.g., [{"imgUrl":"..."}])
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New images to upload (max 3)
 *     responses:
 *       200:
 *         description: Variant updated
 *       400:
 *         description: Barcode already exists or invalid data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 */
router.put(
  "/:id",
  adminAuth,
  upload.fields([{ name: "images", maxCount: 3 }]),
  variantController.update,
);

/**
 * @swagger
 * /api/admin/variant/{id}:
 *   delete:
 *     summary: Delete a variant (only if no stock exists)
 *     tags: [Admin - Variant]
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
 *         description: Variant deleted
 *       400:
 *         description: Cannot delete variant with existing stock
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 */
router.delete("/:id", adminAuth, variantController.delete);

export default router;
