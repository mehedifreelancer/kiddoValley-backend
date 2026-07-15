import { Router } from "express";
import {
  createPathaoOrder,
  cancelPathaoOrder,
} from "../../controllers/pathaoController";

const router = Router();

// Create a Pathao order
router.post("/create-order", createPathaoOrder);

// Cancel a Pathao order by consignment ID
router.delete("/cancel/:consignmentId", cancelPathaoOrder);

export default router;
