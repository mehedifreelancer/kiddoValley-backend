// backend/src/routes/admin/ai.ts
import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { parseCustomerText } from "../../controllers/aiController";

const router = Router();
router.post("/parse-customer-text", adminAuth, parseCustomerText);

export default router;
