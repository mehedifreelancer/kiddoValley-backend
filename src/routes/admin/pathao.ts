import { Router } from "express";
import {
  createPathaoOrder,
  cancelPathaoOrder,
  getDeliveryPrice, // ✅ নতুন কন্ট্রোলার ফাংশন ইমপোর্ট
} from "../../controllers/pathaoController";

const router = Router();

// Create a Pathao order
router.post("/create-order", createPathaoOrder);

// Cancel a Pathao order by consignment ID
router.delete("/cancel/:consignmentId", cancelPathaoOrder);

// 🆕 Get delivery price (Pathao price-plan)
router.post("/price-plan", getDeliveryPrice);

export default router;
