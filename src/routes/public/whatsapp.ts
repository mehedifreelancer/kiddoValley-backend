import { Router } from "express";
import { sendWhatsAppMessage } from "../../controllers/whatsappController";

const router = Router();
router.post("/send", sendWhatsAppMessage);

export default router;