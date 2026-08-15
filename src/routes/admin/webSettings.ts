import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { webSettingsController } from "../../controllers/webSettingsController";
import { uploadLogo } from "../../multer";

const router = Router();

/**
 * @swagger
 * /api/admin/web-settings:
 *   get:
 *     summary: Get all web settings (logo, social links, footer)
 *     tags: [Admin - Web Settings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Returns the settings object
 */
router.get("/", adminAuth, webSettingsController.getSettings);

/**
 * @swagger
 * /api/admin/web-settings:
 *   post:
 *     summary: Update all web settings (logo, social links, footer)
 *     tags: [Admin - Web Settings]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *               socialLinks:
 *                 type: string
 *                 description: JSON string of social links
 *               footerText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.post(
  "/",
  adminAuth,
  uploadLogo.single("logo"),
  webSettingsController.updateSettings,
);
router.get(
  "/packaging-cost",
  adminAuth,
  webSettingsController.getPackagingSettings,
);

router.post(
  "/packaging-cost",
  adminAuth,
  webSettingsController.updatePackagingSettings,
);

export default router;
