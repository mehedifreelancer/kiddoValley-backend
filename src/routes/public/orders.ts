import { Router } from "express";
import { orderController } from "../../controllers/orderController";

const router = Router();

router.post("/orders/website", orderController.createWebsiteOrder);

// অন্যান্য পাবলিক এন্ডপয়েন্ট...
export default router;
