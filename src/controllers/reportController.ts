import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { calculateSalesFinancials } from "../utils/financials";

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

  // ----- Annual Report -----
  // ✅ এখন calculateSalesFinancials() ব্যবহার করে, তাই Sells Report,
  // Balance Summary আর এই Annual Report — তিনটাই একই source থেকে
  // profit হিসাব করছে, কোনো mismatch থাকবে না।
  async getAnnualReport(req: Request, res: Response) {
    try {
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

      // Transactions সবসময় non-sales, কারণ sales কখনো transaction row হিসেবে
      // তৈরিই হয় না — তাই এখানে কোনো category exclude করার দরকার নেই।
      const transactions = await prisma.transaction.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
      });

      const months = [];
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(year, i, 1);
        const monthEnd = new Date(year, i + 1, 0, 23, 59, 59, 999);

        // ✅ Sells Report-এর মতো একই function দিয়ে এই মাসের sales হিসাব
        const { totalSalesAmount, totalRefunds, salesCashIn, salesNetProfit } =
          await calculateSalesFinancials(monthStart, monthEnd);

        const monthTransactions = transactions.filter(
          (t) => new Date(t.date).getMonth() === i,
        );

        const incomeTransactions = monthTransactions.filter(
          (t) => t.category.type === "in",
        );
        const expenseTransactions = monthTransactions.filter(
          (t) => t.category.type === "out",
        );
        // loan/withdraw কে true operating expense ধরা হচ্ছে না
        const filteredExpenses = expenseTransactions.filter(
          (t) => !["take_loan", "withdraw"].includes(t.category.name),
        );

        const otherIncome = incomeTransactions.reduce(
          (sum, t) => sum + t.amount,
          0,
        );
        const expenses = filteredExpenses.reduce((sum, t) => sum + t.amount, 0);

        // 🟢 "মাসিক লাভ" = real profit (delivery/packaging/refund বাদ দেওয়ার পর)
        const monthlyNet = salesNetProfit + otherIncome - expenses;

        // 🔵 "চলতি ক্যাশ"-এর জন্য এই মাসের cash movement — profit থেকে আলাদা,
        // কারণ customer পুরো order total-ই cash হিসেবে দিয়েছে (delivery charge সহ)
        const monthlyCashChange = salesCashIn + otherIncome - expenses;

        months.push({
          month: i + 1,
          monthName: new Date(year, i).toLocaleString("default", {
            month: "long",
          }),
          totalSales: totalSalesAmount,
          totalRefunds,
          salesNetProfit,
          otherIncome,
          expenses,
          monthlyNet,
          monthlyCashChange,
        });
      }

      // Running cash — এখন real cash movement দিয়ে হিসাব হচ্ছে,
      // profit দিয়ে না। এই total-টাই accountController-এর
      // calculateCashBalance()-এর সাথে মিলবে।
      let running = 0;
      const result = months.map((m) => {
        running += m.monthlyCashChange;
        // internal field, response-এ পাঠানোর দরকার নেই
        const { monthlyCashChange, ...rest } = m;
        return { ...rest, runningCash: running };
      });

      const totals = {
        totalSales: result.reduce((s, m) => s + m.totalSales, 0),
        totalRefunds: result.reduce((s, m) => s + m.totalRefunds, 0),
        totalSalesNetProfit: result.reduce((s, m) => s + m.salesNetProfit, 0),
        totalOtherIncome: result.reduce((s, m) => s + m.otherIncome, 0),
        totalExpenses: result.reduce((s, m) => s + m.expenses, 0),
        totalMonthlyNet: result.reduce((s, m) => s + m.monthlyNet, 0),
        finalCash: result[result.length - 1]?.runningCash || 0,
      };

      res.json({
        success: true,
        data: {
          year,
          months: result,
          totals,
        },
      });
    } catch (error: any) {
      console.error("Annual report error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
