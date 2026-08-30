import { Router } from "express";
import { productController } from "../../controllers/productController";
import { adminAuth } from "../../middleware/adminAuth";
import { uploadProductThumbnail } from "../../multer";

const router = Router();

router.get("/getAll", adminAuth, productController.getAllAdmin);
router.get("/getById/:id", adminAuth, productController.getById);

router.post(
  "/create",
  adminAuth,
  uploadProductThumbnail, // ✅ single file, field 'thumbnail'
  productController.create,
);

router.put(
  "/edit/:id",
  adminAuth,
  uploadProductThumbnail,
  productController.update,
);

router.delete("/delete/:id", adminAuth, productController.delete);
router.patch("/publish/:id", adminAuth, productController.publish);
router.patch("/toggle-publish/:id", adminAuth, productController.togglePublish);

export default router;
