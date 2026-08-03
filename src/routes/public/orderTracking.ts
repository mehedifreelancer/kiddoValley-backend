import { Router } from "express";
import { orderTrackingController } from "../../controllers/orderTrackingController";

const router = Router();

// ফোন দিয়ে অর্ডার খুঁজুন
router.get("/search", orderTrackingController.searchOrders);

// কনসাইনমেন্ট ট্র্যাক করুন
router.post("/track", orderTrackingController.trackConsignment);

export default router;
