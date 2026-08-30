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
  // src/controllers/reportController.ts

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

      const transactions = await prisma.transaction.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
      });

      const openingResult = await prisma.$queryRaw<{ net: number }[]>`
      SELECT COALESCE(SUM(CASE WHEN tc.type = 'in' THEN t.amount ELSE -t.amount END), 0) as net
      FROM transactions t
      JOIN transaction_categories tc ON t.categoryId = tc.id
      WHERE t.date < ${startDate}
    `;
      let runningCash = openingResult[0]?.net || 0;

      const months = [];
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(year, i, 1);
        const monthEnd = new Date(year, i + 1, 0, 23, 59, 59, 999);

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

        // Aggregate expense by category
        const expenseMap = new Map<
          string,
          { total: number; notes: string[] }
        >();
        for (const t of expenseTransactions) {
          const cat = t.category.name;
          if (!expenseMap.has(cat)) {
            expenseMap.set(cat, { total: 0, notes: [] });
          }
          const entry = expenseMap.get(cat)!;
          entry.total += t.amount;
          if (t.note) entry.notes.push(t.note);
        }

        const expenseDetails = Array.from(expenseMap.entries()).map(
          ([category, data]) => ({
            category,
            amount: data.total,
            note: data.notes.join(", ") || "—",
          }),
        );

        const filteredExpenses = expenseTransactions.filter(
          (t) => !["take_loan", "withdraw"].includes(t.category.name),
        );

        const otherIncome = incomeTransactions.reduce(
          (sum, t) => sum + t.amount,
          0,
        );
        const expenses = filteredExpenses.reduce((sum, t) => sum + t.amount, 0);

        const monthlyNet = salesNetProfit + otherIncome - expenses;
        const monthlyCashChange = salesCashIn + otherIncome - expenses;

        runningCash += monthlyCashChange;

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
          expenseDetails, // ✅ aggregated
          monthlyNet,
          runningCash,
        });
      }

      const totals = {
        totalSales: months.reduce((s, m) => s + m.totalSales, 0),
        totalRefunds: months.reduce((s, m) => s + m.totalRefunds, 0),
        totalSalesNetProfit: months.reduce((s, m) => s + m.salesNetProfit, 0),
        totalOtherIncome: months.reduce((s, m) => s + m.otherIncome, 0),
        totalExpenses: months.reduce((s, m) => s + m.expenses, 0),
        totalMonthlyNet: months.reduce((s, m) => s + m.monthlyNet, 0),
        finalCash: months[months.length - 1]?.runningCash || 0,
      };

      res.json({
        success: true,
        data: {
          year,
          months,
          totals,
        },
      });
    } catch (error: any) {
      console.error("Annual report error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // src/controllers/reportController.ts
  // ... add this method inside the controller object

  // src/controllers/reportController.ts

  // src/controllers/reportController.ts

  async getDailyReport(req: Request, res: Response) {
    try {
      let { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      if (start > end) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Start date must be before end date",
          });
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          date: { gte: start, lte: end },
        },
        include: { category: true },
      });

      const openingResult = await prisma.$queryRaw<{ net: number }[]>`
      SELECT COALESCE(SUM(CASE WHEN tc.type = 'in' THEN t.amount ELSE -t.amount END), 0) as net
      FROM transactions t
      JOIN transaction_categories tc ON t.categoryId = tc.id
      WHERE t.date < ${start}
    `;
      let runningCash = openingResult[0]?.net || 0;

      const days = [];
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const { totalSalesAmount, totalRefunds, salesCashIn, salesNetProfit } =
          await calculateSalesFinancials(dayStart, dayEnd);

        const dayTransactions = transactions.filter(
          (t) => new Date(t.date).toDateString() === currentDate.toDateString(),
        );

        const incomeTransactions = dayTransactions.filter(
          (t) => t.category.type === "in",
        );
        const expenseTransactions = dayTransactions.filter(
          (t) => t.category.type === "out",
        );

        // Aggregate expense by category
        const expenseMap = new Map<
          string,
          { total: number; notes: string[] }
        >();
        for (const t of expenseTransactions) {
          const cat = t.category.name;
          if (!expenseMap.has(cat)) {
            expenseMap.set(cat, { total: 0, notes: [] });
          }
          const entry = expenseMap.get(cat)!;
          entry.total += t.amount;
          if (t.note) entry.notes.push(t.note);
        }

        const expenseDetails = Array.from(expenseMap.entries()).map(
          ([category, data]) => ({
            category,
            amount: data.total,
            note: data.notes.join(", ") || "—",
          }),
        );

        const filteredExpenses = expenseTransactions.filter(
          (t) => !["take_loan", "withdraw"].includes(t.category.name),
        );

        const otherIncome = incomeTransactions.reduce(
          (s, t) => s + t.amount,
          0,
        );
        const expenses = filteredExpenses.reduce((s, t) => s + t.amount, 0);

        const dailyNet = salesNetProfit + otherIncome - expenses;
        const dailyCashChange = salesCashIn + otherIncome - expenses;

        runningCash += dailyCashChange;

        days.push({
          date: currentDate.toISOString().split("T")[0],
          label: currentDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          totalSales: totalSalesAmount,
          totalRefunds,
          salesNetProfit,
          otherIncome,
          expenses,
          expenseDetails, // ✅ aggregated
          dailyNet,
          runningCash,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const totals = {
        totalSales: days.reduce((s, d) => s + d.totalSales, 0),
        totalRefunds: days.reduce((s, d) => s + d.totalRefunds, 0),
        totalSalesNetProfit: days.reduce((s, d) => s + d.salesNetProfit, 0),
        totalOtherIncome: days.reduce((s, d) => s + d.otherIncome, 0),
        totalExpenses: days.reduce((s, d) => s + d.expenses, 0),
        totalDailyNet: days.reduce((s, d) => s + d.dailyNet, 0),
        finalCash: days[days.length - 1]?.runningCash || 0,
      };

      res.json({
        success: true,
        data: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
          days,
          totals,
        },
      });
    } catch (error: any) {
      console.error("Daily report error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
