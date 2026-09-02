// ============================================================
// ✅ Single source of truth — Sales-সংক্রান্ত সব cash আর profit
// হিসাব এই ফাইল থেকেই আসবে। কোথাও "sales_revenue" নামে কোনো
// transaction row তৈরি করা হয় না — Orders টেবিলই একমাত্র source।
// accountController আর reportController দুটোই এই একই function
// কল করবে, তাই দুই জায়গার সংখ্যা কখনো mismatch হবে না।
// ============================================================

import { prisma } from "../lib/prisma";

export interface SalesFinancials {
  totalSalesAmount: number;
  totalRefunds: number;
  salesCashIn: number;
  salesNetProfit: number;
}

export async function calculateSalesFinancials(
  startDate?: Date,
  endDate?: Date,
): Promise<SalesFinancials> {
  const where: any = {
    orderStatus: { in: ["confirmed", "packed", "delivered"] },
  };
  if (startDate && endDate) {
    where.createdAt = { gte: startDate, lte: endDate };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      soldItems: true,
      refunds: true,
    },
  });

  let totalSalesAmount = 0;
  let totalRefunds = 0;
  let salesNetProfit = 0;

  for (const order of orders) {
    const deliveryCharge = (order as any).deliveryCharge || 0;
    const packagingCost = (order as any).packagingCost || 0;
    const refundTotal = order.refunds.reduce((sum, r) => sum + r.amount, 0);

    let grossProfit = 0;
    for (const item of order.soldItems) {
      const buyPrice = item.buyingOrMakingPrice ?? 0; // ✅ snapshot, stock join না
      const soldPrice = item.unitPrice;
      grossProfit += (soldPrice - buyPrice) * item.quantity;
    }

    totalSalesAmount += (order as any).total || 0;
    totalRefunds += refundTotal;
    salesNetProfit +=
      grossProfit - deliveryCharge - packagingCost - refundTotal;
  }

  const salesCashIn = totalSalesAmount - totalRefunds;

  return { totalSalesAmount, totalRefunds, salesCashIn, salesNetProfit };
}

export async function calculateOtherTransactionsCash(
  startDate?: Date,
  endDate?: Date,
): Promise<number> {
  const where: any = {};
  if (startDate && endDate) {
    where.date = { gte: startDate, lte: endDate };
  }

  const txResult = await prisma.transaction.findMany({
    where,
    include: { category: true },
  });

  return txResult.reduce((net, t) => {
    return net + (t.category.type === "in" ? t.amount : -t.amount);
  }, 0);
}

export async function calculateCashBalance(): Promise<number> {
  const { salesCashIn } = await calculateSalesFinancials();
  const otherCash = await calculateOtherTransactionsCash();
  return salesCashIn + otherCash;
}
