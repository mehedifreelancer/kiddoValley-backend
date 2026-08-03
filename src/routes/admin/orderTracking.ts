import { Router } from "express";
import { orderTrackingController } from "../../controllers/orderTrackingController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

router.post("/sync", adminAuth, orderTrackingController.syncOrderStatus);

export default router;
