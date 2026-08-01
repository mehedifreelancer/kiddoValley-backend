import { Router } from "express";
import { webSettingsController } from "../../controllers/webSettingsController";

const router = Router();

router.get("/", webSettingsController.getPublicSettings);

export default router;
