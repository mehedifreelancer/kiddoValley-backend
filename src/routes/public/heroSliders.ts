import { Router } from "express";
import { heroSliderController } from "../../controllers/heroSliderController";

const router = Router();

router.get("/", heroSliderController.getPublic);

export default router;
