import { Router } from "express";
import { reportController } from "../../controllers/reportController";
import { adminAuth } from "../../middleware/adminAuth";
import { allowRoles } from "../../middleware/roleAuth";

const router = Router();

// ✅ Sells Report
router.get("/sells", adminAuth, reportController.getSellsReport);
// src/routes/admin/report.ts
router.get(
  "/daily-report",
  adminAuth,
  allowRoles(["super_admin", "admin", "data_accountant"]),
  reportController.getDailyReport,
);

export default router;
