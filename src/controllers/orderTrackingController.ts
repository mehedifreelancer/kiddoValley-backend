import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import pathaoService from "../services/pathao.service";

// ----- Helper: Pathao status → Timeline -----
function mapStatusToTimeline(statusData: any): Array<{
  label: string;
  completed: boolean;
  timestamp?: string;
}> {
  const status = statusData.order_status_slug || statusData.order_status || "";
  const steps = [
    { label: "Confirm", key: "confirm" },
    { label: "Picked-up", key: "picked" },
    { label: "In Transit", key: "transit" },
    { label: "Out for Delivery", key: "out_delivery" },
    { label: "Delivered", key: "delivered" },
  ];

  // ম্যাপিং: কোন স্ট্যাটাসে কোন স্টেপ কমপ্লিট
  const statusMap: Record<string, string[]> = {
    Pending: [],
    Assigned: ["confirm"],
    "Pickup assigned": ["confirm"],
    Picked: ["confirm", "picked"],
    On_Hold: ["confirm"],
    Out_Delivery: ["confirm", "picked", "transit", "out_delivery"],
    Delivered: ["confirm", "picked", "transit", "out_delivery", "delivered"],
    Cancelled: ["confirm"],
    Returned: ["confirm"],
  };

  const completedKeys = statusMap[status] || [];
  return steps.map((step) => ({
    label: step.label,
    completed: completedKeys.includes(step.key),
    // timestamp: statusData.updated_at || undefined,
  }));
}

export const orderTrackingController = {
  // ---------- 1. ফোন দিয়ে অর্ডার খোঁজ (পাবলিক) ----------
  // ---------- 1. ফোন দিয়ে অর্ডার খোঁজ (পাবলিক) ----------
  async searchOrders(req: Request, res: Response) {
    try {
      const { phone } = req.query;
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      const orders = await prisma.order.findMany({
        where: {
          OR: [{ customerPhone: phone }, { customerPhone2: phone }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          orderStatus: true,
          pathaoConsignmentId: true,
          createdAt: true,
          customerName: true,
          customerAddress: true,
        },
      });

      // ✅ ২০০ স্ট্যাটাসে খালি অ্যারে রিটার্ন করুন
      return res.status(200).json({
        success: true,
        data: orders, // খালি অ্যারে হলে []
      });
    } catch (error: any) {
      console.error("Search orders error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // ---------- 2. কনসাইনমেন্ট ট্র্যাক (পাবলিক) ----------
  async trackConsignment(req: Request, res: Response) {
    try {
      const { phone, consignmentId } = req.body;
      if (!phone || !consignmentId) {
        return res.status(400).json({
          success: false,
          message: "Phone and consignment ID are required",
        });
      }

      // যাচাই: এই কনসাইনমেন্ট কি ওই ফোনের?
      const order = await prisma.order.findFirst({
        where: {
          pathaoConsignmentId: consignmentId,
          OR: [{ customerPhone: phone }, { customerPhone2: phone }],
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found or invalid consignment",
        });
      }

      // পাথাও থেকে স্ট্যাটাস আনা
      const statusData = await pathaoService.getOrderStatus(consignmentId);
      const timeline = mapStatusToTimeline(statusData);

      res.json({
        success: true,
        data: {
          order,
          timeline,
          statusData,
        },
      });
    } catch (error: any) {
      console.error("Track consignment error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 3. অ্যাডমিন: অর্ডারের পাথাও স্ট্যাটাস সিঙ্ক (ঐচ্ছিক) ----------
  async syncOrderStatus(req: Request, res: Response) {
    try {
      const { orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "orderIds array required",
        });
      }

      const orders = await prisma.order.findMany({
        where: {
          id: { in: orderIds },
          pathaoConsignmentId: { not: null },
        },
      });

      const results = await Promise.all(
        orders.map(async (order) => {
          try {
            const statusData = await pathaoService.getOrderStatus(
              order.pathaoConsignmentId!,
            );
            const deliveryStatus =
              statusData.order_status_slug ||
              statusData.order_status ||
              "Pending";

            await prisma.order.update({
              where: { id: order.id },
              data: {
                deliveryStatus: deliveryStatus,
                pathaoInvoiceId: statusData.invoice_id || null,
                pathaoLastSyncedAt: new Date(),
              },
            });

            return { orderId: order.id, success: true, status: deliveryStatus };
          } catch (err: any) {
            return { orderId: order.id, success: false, error: err.message };
          }
        }),
      );

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error("Sync orders error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
