import { Router } from "express";
import { reportController } from "../../controllers/reportController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

// ✅ Sells Report
router.get("/sells", adminAuth, reportController.getSellsReport);

export default router;
