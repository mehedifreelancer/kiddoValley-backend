import { Router } from "express";
import { sendOrderEmail } from "../../controllers/emailController";

const router = Router();
router.post("/send", sendOrderEmail);

export default router;