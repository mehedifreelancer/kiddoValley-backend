import { Router } from "express";
import { supplierController } from "../../controllers/supplierController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();
router.get("/", adminAuth, supplierController.getSuppliers);
router.get("/:id", adminAuth, supplierController.getSupplier);
router.post("/", adminAuth, supplierController.createSupplier);
router.put("/:id", adminAuth, supplierController.updateSupplier);
router.delete("/:id", adminAuth, supplierController.deleteSupplier);

export default router;
