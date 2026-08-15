// backend/src/routes/public/delivery.ts
import { Router } from "express";
import { calculateDeliveryCharge } from "../../controllers/deliveryChargeController";

const router = Router();

router.post("/calculate", calculateDeliveryCharge);

export default router;
