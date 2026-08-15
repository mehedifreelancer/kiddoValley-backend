// backend/src/routes/public/ai.ts
import { Router } from "express";
import { detectLocation } from "../../controllers/aiController";

const router = Router();

router.post("/detect-location", detectLocation);

export default router;
