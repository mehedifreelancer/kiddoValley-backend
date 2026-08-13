import { Router } from "express";
import { orderController } from "../../controllers/orderController";

const router = Router();

// ✅ অর্ডার লিস্ট (পেজিনেশন)
router.get("/", orderController.getOrders);

// ✅ অর্ডার তৈরি (status new)
router.post("/", orderController.createOrder);

// ✅ তৈরি + কনফর্ম একসাথে
router.post("/confirm-and-pack", orderController.createAndConfirmOrder);

// ✅ অর্ডার কনফর্ম (পাথাও বুকিং)
router.put("/:id/confirm", orderController.confirmOrder);

// ✅ অর্ডার আপডেট (শুধু new স্ট্যাটাসে)
router.put("/:id", orderController.updateOrder);

// ✅ অর্ডার বাতিল
router.delete("/:id", orderController.cancelOrder);

// ✅ অর্ডার ডিলিট (হার্ড)
router.delete("/:id/delete", orderController.deleteOrder);

// ✅ অর্ডার ডিটেইলস
router.get("/:id", orderController.getOrderDetails);
router.post("/:id/refund", orderController.refund);

// ✅ টেস্ট রাউট (ঐচ্ছিক)
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Orders route is working!" });
});

export default router;
