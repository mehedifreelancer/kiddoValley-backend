// routes/admin/delivery.ts

import { Router } from "express";
import { calculateDeliveryCharge } from "../../controllers/deliveryChargeController";
import { adminAuth } from "../../middleware/adminAuth";
import { webSettingsController } from "../../controllers/webSettingsController";

const router = Router();

router.post("/calculate", adminAuth, calculateDeliveryCharge);
router.get(
  "/get-delivery-charge-info",
  adminAuth,
  webSettingsController.getDeliverySettings,
);
router.put(
  "/update-delivery-charge-info",
  adminAuth,
  webSettingsController.updateDeliverySettings,
);

export default router;
