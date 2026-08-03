import { Router } from "express";
import { customerController } from "../../controllers/customerController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

router.get("/", adminAuth, customerController.getCustomers);
router.get("/:phone", adminAuth, customerController.getCustomer);
router.post("/", adminAuth, customerController.createCustomer); // ✅ নতুন
router.put("/:phone", adminAuth, customerController.updateCustomer);
router.delete("/:phone", adminAuth, customerController.deleteCustomer);

export default router;
