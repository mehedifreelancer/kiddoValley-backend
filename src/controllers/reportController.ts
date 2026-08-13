import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const reportController = {
  // ============================================================
  // SELLS REPORT – Direct + Proportional refund distribution
  // ============================================================
  async getSellsReport(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      let start: Date, end: Date;
      if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
      } else {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }

      // অর্ডার + সোল্ড আইটেম + স্টক + রিফান্ড (অর্ডার লেভেল)
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        include: {
          soldItems: {
            include: {
              stock: true,
            },
          },
          refunds: true, // অর্ডারের সব রিফান্ড
        },
        orderBy: { createdAt: "asc" },
      });

      const reportData = orders.map((order) => {
        // ---- ১. রিফান্ড আলাদা করা ----
        const directRefundsByItem = new Map<number, number>(); // soldItemId -> total amount
        let orderLevelTotal = 0;

        order.refunds.forEach((r) => {
          if (r.soldItemId !== null) {
            const existing = directRefundsByItem.get(r.soldItemId) || 0;
            directRefundsByItem.set(r.soldItemId, existing + r.amount);
          } else {
            orderLevelTotal += r.amount;
          }
        });

        // অর্ডারের মোট বিক্রয় (আইটেমের totalPrice যোগ)
        const orderTotal = order.soldItems.reduce(
          (sum, item) => sum + item.totalPrice,
          0,
        );

        // ডেলিভারি চার্জ (যদি থাকে, নাহলে ০)
        const orderDeliveryCharge = 0; // (order as any).deliveryCharge || 0;

        const items = order.soldItems.map((item) => {
          const buyPrice = item.stock?.buyingOrMakingPrice || 0;
          const sellingPrice = item.stock?.sellingPrice || 0;
          const soldPrice = item.unitPrice;
          const weight = item.quantity;
          const grossProfit = (soldPrice - buyPrice) * weight;

          // ---- ২. আইটেমের জন্য রিফান্ড অ্যামাউন্ট ----
          // Direct refund for this item
          const directAmount = directRefundsByItem.get(item.id) || 0;

          // Proportional share of order-level refunds
          let proportionalAmount = 0;
          if (orderTotal > 0 && orderLevelTotal > 0) {
            proportionalAmount =
              (item.totalPrice / orderTotal) * orderLevelTotal;
          }

          const returnAmount = directAmount + proportionalAmount;

          // প্যাকেজিং কস্ট (যদি থাকে)
          const packagingCost = 0;

          // নেট প্রফিট = গ্রস – (ডেলিভারি + প্যাকেজিং + রিফান্ড)
          const netProfit =
            grossProfit - (orderDeliveryCharge + packagingCost + returnAmount);

          return {
            id: item.id,
            productName: item.productName,
            buyPrice: buyPrice,
            sellingPrice: sellingPrice,
            soldPrice: soldPrice,
            weight: weight,
            grossProfit: grossProfit,
            deliveryCharge: orderDeliveryCharge,
            returnAmount: returnAmount,
            netProfit: netProfit,
          };
        });

        return {
          invoiceNo: order.invoiceNo,
          items: items,
        };
      });

      res.json({
        success: true,
        data: reportData,
      });
    } catch (error: any) {
      console.error("Sells Report error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
