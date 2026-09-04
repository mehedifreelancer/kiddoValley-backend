import { Router } from "express";
import { worksheetController } from "../../controllers/worksheetController";

const router = Router();

// Public routes – no authentication required
router.get("/worksheets", worksheetController.getAllPublic);
router.get("/worksheets/:id/download", worksheetController.downloadFile);

export default router;
