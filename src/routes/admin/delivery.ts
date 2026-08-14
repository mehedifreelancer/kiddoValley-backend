// routes/admin/delivery.ts

import { Router } from "express";
import { calculateDeliveryCharge } from "../../controllers/deliveryController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

router.post("/calculate", adminAuth, calculateDeliveryCharge);

export default router;
