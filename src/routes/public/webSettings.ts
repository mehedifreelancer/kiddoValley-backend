import { Router } from "express";
import { webSettingsController } from "../../controllers/webSettingsController";

const router = Router();

router.get("/", webSettingsController.getPublicSettings);
router.get("/layout-settings", webSettingsController.getPublicLayoutSettings);

export default router;
