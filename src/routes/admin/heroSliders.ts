import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { heroSliderController } from "../../controllers/heroSliderController";
import { uploadHeroSliderImage } from "../../multer";

const router = Router();

router.get("/", adminAuth, heroSliderController.getAll);
router.post("/", adminAuth, heroSliderController.create);
router.put("/:id", adminAuth, heroSliderController.update);
router.delete("/:id", adminAuth, heroSliderController.delete);
router.post("/reorder", adminAuth, heroSliderController.reorder);
router.post(
  "/upload",
  adminAuth,
  uploadHeroSliderImage.single("image"),
  heroSliderController.uploadImage,
);
export default router;
