import { Request, Response } from "express";
import pathaoService from "../services/pathao.service";

export const createPathaoOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, customerName, customerPhone, customerAddress, total, items } = req.body;

    if (!orderId || !customerName || !customerPhone || !customerAddress || !total) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payload = {
      merchant_order_id: String(orderId),
      recipient_name: customerName,
      recipient_phone: customerPhone,
      recipient_address: customerAddress,
      delivery_type: 48,
      item_type: 2,
      item_weight: 0.5,
      amount_to_collect: total,
      item_quantity: items?.length || 1,
    };

    const result = await pathaoService.createOrder(payload);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Pathao order creation error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};