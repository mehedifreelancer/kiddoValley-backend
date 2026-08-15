// backend/src/controllers/public/aiController.ts
import { Request, Response } from "express";
import {
  detectLocationOnly,
  parseWithGroq,
} from "../services/ai/groqClient.service";

export const detectLocation = async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== "string" || !address.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "address is required" });
    }

    if (address.length > 500) {
      return res
        .status(400)
        .json({ success: false, message: "address is too long" });
    }

    const locationType = await detectLocationOnly(address);
    res.json({ success: true, data: { locationType } });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to detect location",
    });
  }
};
export const parseCustomerText = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "text is required" });
    }
    const parsed = await parseWithGroq(text);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res
      .status(500)
      .json({ success: false, message: error.message || "AI parsing failed" });
  }
};
