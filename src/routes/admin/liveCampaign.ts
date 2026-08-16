import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { liveCampaignController } from "../../controllers/liveCampaignController";

const router = Router();

router.get("/", adminAuth, liveCampaignController.getCampaigns);
router.post("/", adminAuth, liveCampaignController.createCampaign);
router.put("/:id", adminAuth, liveCampaignController.updateCampaign);
router.delete("/:id", adminAuth, liveCampaignController.deleteCampaign);
router.patch("/:id/status", adminAuth, liveCampaignController.toggleStatus);
router.get(
  "/:id/history",
  adminAuth,
  liveCampaignController.getCampaignHistory,
);

export default router;
