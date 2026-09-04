import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const dashboardController = {
  // ---------- 1. OVERVIEW (with refund deduction) ----------
  // dashboardController.ts - শুধু getOverview মেথড আপডেট করা হয়েছে

  async getOverview(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      // শুধু কনফর্মড/প্যাকড/ডেলিভার্ড অর্ডার বিবেচনা করব
      const whereOrder = {
        createdAt: { gte: start, lte: end },
        orderStatus: { in: ["confirmed", "packed", "delivered"] },
      };

      // ১. অর্ডার ও গ্রাহক স্ট্যাট
      const [totalOrders, totalRevenueBeforeRefund, totalCustomers] =
        await Promise.all([
          prisma.order.count({ where: whereOrder }),
          prisma.order.aggregate({
            where: whereOrder,
            _sum: { total: true },
          }),
          prisma.customerInfo.count({
            where: {
              orders: {
                some: {
                  createdAt: { gte: start, lte: end },
                  orderStatus: { in: ["confirmed", "packed", "delivered"] },
                },
              },
            },
          }),
        ]);

      // ২. রিফান্ড স্ট্যাটিস্টিক্স (type অনুযায়ী গ্রুপ)
      const refundStats = await prisma.refund.groupBy({
        by: ["type"],
        where: {
          order: {
            createdAt: { gte: start, lte: end },
            orderStatus: { in: ["confirmed", "packed", "delivered"] },
          },
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      // ডিফল্ট ০
      let partialCount = 0;
      let fullCount = 0;
      let partialAmount = 0;
      let fullAmount = 0;

      refundStats.forEach((stat) => {
        if (stat.type === "partial") {
          partialCount = stat._count.id;
          partialAmount = stat._sum.amount || 0;
        } else if (stat.type === "full") {
          fullCount = stat._count.id;
          fullAmount = stat._sum.amount || 0;
        }
      });

      const totalRefund = partialAmount + fullAmount;

      // ৩. নেট রেভিনিউ
      const totalRevenue =
        (totalRevenueBeforeRefund._sum.total || 0) - totalRefund;

      // ৪. মোট লাভ ও পণ্য বিক্রয় (রিফান্ডের আগে)
      const profitAndQuantity: any[] = await prisma.$queryRaw`
      SELECT 
        SUM((s.unitPrice - st.buyingOrMakingPrice) * s.quantity) as totalProfit,
        SUM(s.quantity) as totalProductsSold
      FROM \`sold_items\` s
      JOIN \`stocks\` st ON st.id = s.stockId
      JOIN \`orders\` o ON o.id = s.orderId
      WHERE o.createdAt >= ${start} AND o.createdAt <= ${end}
        AND o.orderStatus IN ('confirmed', 'packed', 'delivered')
    `;
      const totalProfitBeforeRefund =
        Number(profitAndQuantity[0]?.totalProfit) || 0;
      const totalProductsSold =
        Number(profitAndQuantity[0]?.totalProductsSold) || 0;

      // ৫. নেট লাভ
      const totalProfit = totalProfitBeforeRefund - totalRefund;

      // ৬. গড় মান
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const avgProfit = totalOrders > 0 ? totalProfit / totalOrders : 0;

      res.json({
        success: true,
        data: {
          // আগের কার্ডগুলো
          totalOrders,
          totalRevenue,
          totalCustomers,
          avgOrderValue,
          totalProfit,
          totalProductsSold,
          avgProfit,

          // ✅ নতুন ৪টি কার্ড
          totalPartialRefunds: partialCount,
          totalFullRefunds: fullCount,
          partialRefundAmount: partialAmount,
          fullRefundAmount: fullAmount,
        },
      });
    } catch (error: any) {
      console.error("Overview error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 2. SALES TREND ----------
  async getSalesTrend(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      // রিফান্ড বিবেচনায় এনে নেট সেলস ট্রেন্ড
      // ১. প্রতিদিনের অর্ডার টোটাল
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        select: { createdAt: true, total: true, id: true },
        orderBy: { createdAt: "asc" },
      });

      // ২. প্রতিদিনের রিফান্ড টোটাল
      const refunds: any[] = await prisma.$queryRaw`
        SELECT DATE(o.createdAt) as date, SUM(r.amount) as refundAmount
        FROM \`refunds\` r
        JOIN \`orders\` o ON o.id = r.orderId
        WHERE o.createdAt >= ${start} AND o.createdAt <= ${end}
          AND o.orderStatus IN ('confirmed', 'packed', 'delivered')
        GROUP BY DATE(o.createdAt)
      `;

      const refundMap: Record<string, number> = {};
      refunds.forEach((r) => {
        const date = new Date(r.date).toISOString().split("T")[0];
        refundMap[date] = Number(r.refundAmount) || 0;
      });

      const grouped: Record<string, number> = {};
      orders.forEach((order) => {
        const date = order.createdAt.toISOString().split("T")[0];
        grouped[date] = (grouped[date] || 0) + order.total;
      });

      // নেট সেলস = অর্ডার টোটাল - রিফান্ড
      const data = Object.keys(grouped).map((date) => ({
        date,
        total: grouped[date] - (refundMap[date] || 0),
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Sales trend error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 3. BEST PRODUCTS ----------
  async getBestProducts(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const soldItems = await prisma.soldItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, totalPrice: true },
        where: {
          order: {
            createdAt: { gte: start, lte: end },
            orderStatus: { in: ["confirmed", "packed", "delivered"] },
          },
        },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      });

      const productIds = soldItems
        .map((item) => item.productId)
        .filter((id): id is number => id !== null);

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });

      // রিফান্ডেড আইটেমগুলোর প্রভাব বাদ দিতে চাইলে এখানে রিফান্ড কমানো যেতে পারে,
      // কিন্তু বিক্রি সংখ্যা সাধারণত রিফান্ডে প্রভাবিত হয় না (পণ্য ফেরত না)।
      const data = soldItems.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          name: product?.name || "Unknown",
          quantity: item._sum.quantity || 0,
          revenue: item._sum.totalPrice || 0,
        };
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Best products error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 4. CATEGORY SALES ----------
  async getCategorySales(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const soldItems = await prisma.soldItem.findMany({
        where: {
          order: {
            createdAt: { gte: start, lte: end },
            orderStatus: { in: ["confirmed", "packed", "delivered"] },
          },
        },
        select: { productId: true, totalPrice: true },
      });

      const productIds = soldItems
        .map((item) => item.productId)
        .filter((id): id is number => id !== null);

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, categoryId: true },
      });

      const categories = await prisma.category.findMany({
        select: { id: true, name: true },
      });

      const categoryMap: Record<number, number> = {};
      soldItems.forEach((item) => {
        if (item.productId === null) return;
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const catId = product.categoryId;
          categoryMap[catId] = (categoryMap[catId] || 0) + item.totalPrice;
        }
      });

      const data = Object.keys(categoryMap).map((catId) => {
        const cat = categories.find((c) => c.id === parseInt(catId));
        return {
          name: cat?.name || "Uncategorized",
          value: categoryMap[parseInt(catId)],
        };
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Category sales error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 5. TOP CUSTOMERS ----------
  async getTopCustomers(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const orders = await prisma.order.groupBy({
        by: ["orderedByPhone", "customerName"],
        where: {
          createdAt: { gte: start, lte: end },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        _count: { id: true },
        _sum: { total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 10,
      });

      const data = orders.map((order) => ({
        phone: order.orderedByPhone || "Unknown",
        name: order.customerName || "Unknown",
        totalOrders: order._count.id,
        totalSpent: order._sum.total || 0,
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Top customers error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 6. HEATMAP ----------
  async getHeatmap(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: "asc" },
      });

      const grouped: Record<string, number> = {};
      orders.forEach((order) => {
        const date = order.createdAt.toISOString().split("T")[0];
        grouped[date] = (grouped[date] || 0) + order.total;
      });

      const data = Object.keys(grouped).map((date) => ({
        day: date,
        total: grouped[date],
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Heatmap error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 7. RETENTION ----------
  async getRetention(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const customers = await prisma.customerInfo.findMany({
        where: {
          orders: {
            some: {
              createdAt: { gte: start, lte: end },
              orderStatus: { in: ["confirmed", "packed", "delivered"] },
            },
          },
        },
        select: {
          phone: true,
          orders: {
            select: { total: true },
          },
        },
      });

      let newCount = 0;
      let returningCount = 0;
      let newSpent = 0;
      let returningSpent = 0;

      customers.forEach((customer) => {
        const orderCount = customer.orders.length;
        const totalSpent = customer.orders.reduce((sum, o) => sum + o.total, 0);
        if (orderCount <= 1) {
          newCount++;
          newSpent += totalSpent;
        } else {
          returningCount++;
          returningSpent += totalSpent;
        }
      });

      res.json({
        success: true,
        data: {
          new: { count: newCount, spent: newSpent },
          returning: { count: returningCount, spent: returningSpent },
        },
      });
    } catch (error: any) {
      console.error("Retention error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 8. PAYMENT STATUS ----------
  async getPaymentStatus(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const result = await prisma.order.groupBy({
        by: ["paymentStatus"],
        where: {
          createdAt: { gte: start, lte: end },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        _count: { id: true },
      });

      const data = result.map((item) => ({
        paymentStatus: item.paymentStatus,
        _count: item._count.id,
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Payment status error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 9. ORDER STATUS ----------
  async getOrderStatus(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const result = await prisma.order.groupBy({
        by: ["orderStatus"],
        where: {
          createdAt: { gte: start, lte: end },
        },
        _count: { id: true },
      });

      const data = result.map((item) => ({
        orderStatus: item.orderStatus,
        _count: item._count.id,
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Order status error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 10. TOP PROFIT PRODUCTS ----------
  async getTopProfitProducts(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const profitData = (await prisma.$queryRaw`
        SELECT 
          p.id as productId,
          p.name as productName,
          SUM((s.unitPrice - st.buyingOrMakingPrice) * s.quantity) as profit
        FROM \`sold_items\` s
        JOIN \`stocks\` st ON st.id = s.stockId
        JOIN \`products\` p ON p.id = s.productId
        JOIN \`orders\` o ON o.id = s.orderId
        WHERE o.createdAt >= ${start} AND o.createdAt <= ${end}
          AND o.orderStatus IN ('confirmed', 'packed', 'delivered')
        GROUP BY p.id, p.name
        ORDER BY profit DESC
        LIMIT 10
      `) as any[];

      const data = profitData.map((p) => ({
        name: p.productName,
        profit: Number(p.profit) || 0,
      }));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Top profit products error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 11. PRODUCT SALES ----------
  async getProductSales(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const productSales = await prisma.soldItem.groupBy({
        by: ["productId"],
        _sum: { totalPrice: true },
        where: {
          order: {
            createdAt: { gte: start, lte: end },
            orderStatus: { in: ["confirmed", "packed", "delivered"] },
          },
        },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 10,
      });

      const productIds = productSales
        .map((item) => item.productId)
        .filter((id): id is number => id !== null);

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });

      const data = productSales.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          name: product?.name || "Unknown",
          value: item._sum.totalPrice || 0,
        };
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Product sales error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 12. SALES VS PROFIT ----------
  async getSalesVsProfit(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const salesProfitData = await prisma.$queryRaw`
        SELECT 
          DATE(o.createdAt) as date,
          SUM(o.total) as revenue,
          SUM((s.unitPrice - st.buyingOrMakingPrice) * s.quantity) as profit
        FROM \`orders\` o
        JOIN \`sold_items\` s ON s.orderId = o.id
        JOIN \`stocks\` st ON st.id = s.stockId
        WHERE o.createdAt >= ${start} AND o.createdAt <= ${end}
          AND o.orderStatus IN ('confirmed', 'packed', 'delivered')
        GROUP BY DATE(o.createdAt)
        ORDER BY date ASC
      `;

      res.json({ success: true, data: salesProfitData });
    } catch (error: any) {
      console.error("Sales vs Profit error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- 13. ORDER TRAFFIC ----------
  async getOrderTraffic(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      const timeSlots = [
        { label: "12-3 AM", start: 0, end: 3 },
        { label: "3-6 AM", start: 3, end: 6 },
        { label: "6-9 AM", start: 6, end: 9 },
        { label: "9-12 PM", start: 9, end: 12 },
        { label: "12-3 PM", start: 12, end: 15 },
        { label: "3-6 PM", start: 15, end: 18 },
        { label: "6-9 PM", start: 18, end: 21 },
        { label: "9-12 AM", start: 21, end: 24 },
      ];

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        select: {
          createdAt: true,
          total: true,
          isWebsiteOrder: true,
        },
      });

      const data: any = {};
      orders.forEach((order) => {
        const date = new Date(order.createdAt);
        const day = date.getDay();
        const hour = date.getHours();
        const slotIndex = timeSlots.findIndex(
          (s) => hour >= s.start && hour < s.end,
        );
        if (slotIndex === -1) return;

        const key = `${day}-${slotIndex}`;
        if (!data[key]) {
          data[key] = { day, slot: slotIndex, website: 0, custom: 0 };
        }
        if (order.isWebsiteOrder) {
          data[key].website += order.total;
        } else {
          data[key].custom += order.total;
        }
      });

      const websiteData: any[] = [];
      const customData: any[] = [];

      Object.values(data).forEach((item: any) => {
        const dayLabel = dayNames[item.day];
        const slotLabel = timeSlots[item.slot].label;
        websiteData.push({ x: dayLabel, y: slotLabel, value: item.website });
        customData.push({ x: dayLabel, y: slotLabel, value: item.custom });
      });

      res.json({
        success: true,
        data: {
          website: websiteData,
          custom: customData,
          timeSlots: timeSlots.map((s) => s.label),
          dayNames,
        },
      });
    } catch (error: any) {
      console.error("Order traffic error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // dashboardController.ts - নতুন মেথড যোগ করুন

  // ---------- TOP DEFECT INTENSIVE PRODUCTS ----------
  // dashboardController.ts - getTopDefectProducts
  async getTopDefectProducts(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(
        startDate as string,
        endDate as string,
      );

      console.log("📅 Date range:", { start, end });

      // প্রথম কুয়েরি: সরাসরি soldItemId দিয়ে
      const result = await prisma.$queryRaw`
      SELECT 
        p.id AS productId,
        p.name AS productName,
        COALESCE(SUM(si.quantity), 0) AS totalSoldQuantity,
        COUNT(r.id) AS refundCount
      FROM \`refunds\` r
      LEFT JOIN \`sold_items\` si ON si.id = r.soldItemId
      LEFT JOIN \`products\` p ON p.id = si.productId
      WHERE r.reason = 'defect'
        AND r.createdAt >= ${start} AND r.createdAt <= ${end}
      GROUP BY p.id, p.name
      HAVING p.id IS NOT NULL
      ORDER BY refundCount DESC
      LIMIT 10
    `;

      console.log("🔍 Query result:", result);

      let finalData: any[] = [];

      if ((result as any[]).length > 0) {
        finalData = (result as any[]).map((p) => {
          const refundCount = Number(p.refundCount) || 0;
          const totalSold = Number(p.totalSoldQuantity) || 0;
          const percentage =
            totalSold > 0 ? (refundCount * 100) / totalSold : 0;
          return {
            productName: p.productName || "Unknown",
            defectRefundCount: refundCount,
            totalSoldQuantity: totalSold,
            defectPercentage: Number(percentage.toFixed(2)),
          };
        });
      } else {
        // দ্বিতীয় কুয়েরি: orderId দিয়ে sold_items জয়েন (যখন soldItemId null)
        console.log("⚠️ No results from first query, trying alternative...");
        const altResult = await prisma.$queryRaw`
        SELECT 
          p.id AS productId,
          p.name AS productName,
          COALESCE(SUM(si.quantity), 0) AS totalSoldQuantity,
          COUNT(r.id) AS refundCount
        FROM \`refunds\` r
        LEFT JOIN \`sold_items\` si ON si.orderId = r.orderId
        LEFT JOIN \`products\` p ON p.id = si.productId
        WHERE r.reason = 'defect'
          AND r.createdAt >= ${start} AND r.createdAt <= ${end}
        GROUP BY p.id, p.name
        HAVING p.id IS NOT NULL
        ORDER BY refundCount DESC
        LIMIT 10
      `;
        console.log("🔍 Alternative query result:", altResult);

        finalData = (altResult as any[]).map((p) => {
          const refundCount = Number(p.refundCount) || 0;
          const totalSold = Number(p.totalSoldQuantity) || 0;
          const percentage =
            totalSold > 0 ? (refundCount * 100) / totalSold : 0;
          return {
            productName: p.productName || "Unknown",
            defectRefundCount: refundCount,
            totalSoldQuantity: totalSold,
            defectPercentage: Number(percentage.toFixed(2)),
          };
        });
      }

      res.json({ success: true, data: finalData });
    } catch (error: any) {
      console.error("Top defect products error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

// Helper function
function getDateRange(
  startDate?: string,
  endDate?: string,
): { start: Date; end: Date } {
  let start: Date, end: Date;
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date();
    start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}
