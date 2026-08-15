import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const reportController = {
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

      // অর্ডার + সোল্ড আইটেম + স্টক + রিফান্ড
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
          refunds: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const reportData = orders.map((order) => {
        // ---- ১. রিফান্ড বণ্টন ----
        const directRefundsByItem = new Map<number, number>();
        let orderLevelTotal = 0;

        order.refunds.forEach((r) => {
          if (r.soldItemId !== null) {
            const existing = directRefundsByItem.get(r.soldItemId) || 0;
            directRefundsByItem.set(r.soldItemId, existing + r.amount);
          } else {
            orderLevelTotal += r.amount;
          }
        });

        const orderTotal = order.soldItems.reduce(
          (sum, item) => sum + item.totalPrice,
          0,
        );

        // ✅ অর্ডার লেভেল ডেলিভারি চার্জ ও প্যাকেজিং কস্ট (ডাটাবেস থেকে)
        const deliveryCharge = (order as any).deliveryCharge || 0;
        const packagingCost = (order as any).packagingCost || 0;

        // ✅ অর্ডারের নিজস্ব "total" কলাম (ডাটাবেস থেকে সরাসরি) — এটাই আসল
        // Total Bill, checkout-এর সময় যা সেভ হয়েছিল। items থেকে আলাদাভাবে
        // হিসাব করে বের করার দরকার নেই, কারণ ডাটাবেসেই এটা রাখা আছে।
        const orderTotal_dbTotal = (order as any).total || 0;

        // ---- ২. প্রতিটি আইটেমের জন্য ডেটা তৈরি ----
        const items = order.soldItems.map((item) => {
          const buyPrice = item.stock?.buyingOrMakingPrice || 0;
          const sellingPrice = item.stock?.sellingPrice || 0;
          const soldPrice = item.unitPrice;
          const weight = item.quantity;
          const grossProfit = (soldPrice - buyPrice) * weight;

          // Direct refund
          const directAmount = directRefundsByItem.get(item.id) || 0;

          // Proportional refund
          let proportionalAmount = 0;
          if (orderTotal > 0 && orderLevelTotal > 0) {
            proportionalAmount =
              (item.totalPrice / orderTotal) * orderLevelTotal;
          }
          const returnAmount = directAmount + proportionalAmount;

          // ✅ ডেলিভারি ও প্যাকেজিং বণ্টন (আইটেমের টোটাল প্রাইস অনুপাতে)
          let itemDeliveryCharge = 0;
          let itemPackagingCost = 0;
          if (orderTotal > 0) {
            const ratio = item.totalPrice / orderTotal;
            itemDeliveryCharge = deliveryCharge * ratio;
            itemPackagingCost = packagingCost * ratio;
          }

          // ✅ নেট প্রফিট = গ্রস – (ডেলিভারি + প্যাকেজিং + রিফান্ড)
          const netProfit =
            grossProfit -
            (itemDeliveryCharge + itemPackagingCost + returnAmount);

          return {
            id: item.id,
            productName: item.productName,
            buyPrice: buyPrice,
            sellingPrice: sellingPrice,
            soldPrice: soldPrice,
            weight: weight, // ⚠️ নামে "weight" হলেও এটা আসলে item.quantity — কয়টি নেওয়া হয়েছে
            grossProfit: grossProfit,
            deliveryCharge: itemDeliveryCharge,
            packagingCost: itemPackagingCost, // 🆕 নতুন ফিল্ড
            returnAmount: returnAmount,
            netProfit: netProfit,
          };
        });

        return {
          invoiceNo: order.invoiceNo,
          items: items,
          // অর্ডার টোটালেও রাখতে পারি (UI-তে ব্যবহারের জন্য)
          orderTotals: {
            deliveryCharge,
            packagingCost,
            refundTotal: order.refunds.reduce((sum, r) => sum + r.amount, 0),
            total: orderTotal_dbTotal, // 🆕 Invoice-এর পাশে "Total Bill" দেখানোর জন্য
          },
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
