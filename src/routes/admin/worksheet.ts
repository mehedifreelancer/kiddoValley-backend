import { Router } from "express";
import { worksheetController } from "../../controllers/worksheetController";
import { uploadWorksheet } from "../../multer";

const router = Router();

// Admin routes
router.get("/", worksheetController.getAllAdmin);
router.get("/:id", worksheetController.getById);
router.post("/", uploadWorksheet.single("file"), worksheetController.create);
router.put("/:id", uploadWorksheet.single("file"), worksheetController.update);
router.delete("/:id", worksheetController.delete);

export default router;
