import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { sliderController } from "../../controllers/sliderController";
import { uploadSliderImage } from "../../multer";

const router = Router();

router.get("/", adminAuth, sliderController.getSliders);
router.post(
  "/",
  adminAuth,
  uploadSliderImage.single("image"),
  sliderController.addSlider,
);
router.put("/reorder", adminAuth, sliderController.reorderSliders);
router.delete("/:id", adminAuth, sliderController.deleteSlider);

export default router;
