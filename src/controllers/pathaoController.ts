import { Request, Response } from "express";
import pathaoService from "../services/pathao.service";

// Create a Pathao order (called from your order flow)
export const createPathaoOrder = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      customerName,
      customerPhone,
      customerAddress,
      total,
      items,
    } = req.body;

    if (
      !orderId ||
      !customerName ||
      !customerPhone ||
      !customerAddress ||
      !total
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payload = {
      merchant_order_id: String(orderId),
      recipient_name: customerName,
      recipient_phone: customerPhone,
      recipient_address: customerAddress,
      delivery_type: 48, // Normal delivery
      item_type: 2, // Parcel
      item_weight: 0.5, // in KG (min 0.5)
      amount_to_collect: total,
      item_quantity: items?.length || 1,
      // Optional fields if you have them:
      // recipient_city: ...,
      // recipient_zone: ...,
      // recipient_area: ...,
      // special_instruction: "...",
      // item_description: "...",
    };

    const result = await pathaoService.createOrder(payload);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Pathao order creation error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Cancel a Pathao order (admin route)
export const cancelPathaoOrder = async (req: Request, res: Response) => {
  try {
    const { consignmentId } = req.params;
    if (!consignmentId) {
      return res.status(400).json({ error: "consignmentId is required" });
    }
    const result = await pathaoService.cancelOrder(consignmentId);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("Pathao cancel error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
