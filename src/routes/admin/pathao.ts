import { Router } from "express";
import { createPathaoOrder } from "../../controllers/pathaoController";

const router = Router();
router.post("/create-order", createPathaoOrder);

export default router;