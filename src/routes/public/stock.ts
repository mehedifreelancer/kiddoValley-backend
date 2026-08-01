import { Router } from "express";
import { stockController } from "../../controllers/stockController";

const router = Router();

// ✅ সিঙ্গেল স্টক চেক (GET বা POST)
router.get("/check-single", stockController.checkSingleStock);
// ✅ বাল্ক স্টক চেক (POST)
router.post("/check-bulk", stockController.checkBulkStock);

export default router;
