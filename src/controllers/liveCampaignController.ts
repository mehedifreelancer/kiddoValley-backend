// src/controllers/liveCampaignController.ts

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

const calcProfit = (order: any) => {
  const refundTotal = order.refunds.reduce(
    (s: number, r: any) => s + r.amount,
    0,
  );
  let gross = 0;
  for (const item of order.soldItems) {
    const buyPrice = item.stock?.buyingOrMakingPrice || 0;
    gross += (item.unitPrice - buyPrice) * item.quantity;
  }
  return (
    gross -
    (order.deliveryCharge || 0) -
    (order.packagingCost || 0) -
    refundTotal
  );
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// FIX: local timezone অনুযায়ী YYYY-MM-DD key বানানোর জন্য —
// toISOString().slice(0,10) ব্যবহার করা যাবে না কারণ সেটা UTC-তে convert করে,
// আর বাকি সব boundary logic (today, campaignStartDay, dataBoundaryDay)
// local timezone (setHours) ভিত্তিক। দুই জায়গায় দুই timezone মিশে গেলেই
// "আজকের" ডেট ভুল bucket-এ চলে যায়।
const toLocalDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const liveCampaignController = {
  // ---------- CRUD ----------
  async getCampaigns(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search
        ? { title: { contains: search, mode: "insensitive" } }
        : {};

      const [data, total] = await Promise.all([
        prisma.campaign.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.campaign.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createCampaign(req: Request, res: Response) {
    try {
      const { title, perDayBudget, estimatedEndDate } = req.body;
      if (!title || !perDayBudget || perDayBudget <= 0 || !estimatedEndDate) {
        return res.status(400).json({
          success: false,
          message: "Title, positive budget, and estimated end date required",
        });
      }

      const endDate = new Date(estimatedEndDate);
      if (isNaN(endDate.getTime()) || endDate < startOfDay(new Date())) {
        return res.status(400).json({
          success: false,
          message: "Estimated end date must be a valid future date",
        });
      }

      const campaign = await prisma.campaign.create({
        data: {
          title,
          perDayBudget,
          estimatedEndDate: endDate,
          status: "active",
        },
      });
      res.status(201).json({ success: true, data: campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateCampaign(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { title, perDayBudget, estimatedEndDate, status } = req.body;

      const data: any = { title, perDayBudget, status };
      if (estimatedEndDate) {
        data.estimatedEndDate = new Date(estimatedEndDate);
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data,
      });
      res.json({ success: true, data: campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteCampaign(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await prisma.campaign.delete({ where: { id } });
      res.json({ success: true, message: "Campaign deleted" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- Stop/Start ----------
  async toggleStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          status,
          stoppedAt: status === "stopped" ? new Date() : null,
        },
      });
      res.json({ success: true, data: campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---------- Single endpoint: live summary + history charts ----------
  async getCampaignHistory(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign) {
        return res
          .status(404)
          .json({ success: false, message: "Campaign not found" });
      }

      const now = new Date();
      const today = startOfDay(now);
      const campaignStartDay = startOfDay(campaign.createdAt);
      const rawEndDay = startOfDay(campaign.estimatedEndDate);
      const campaignEndDay =
        rawEndDay < campaignStartDay ? campaignStartDay : rawEndDay;

      const dataBoundary = campaign.stoppedAt || now;
      const dataBoundaryDay = startOfDay(dataBoundary);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: campaign.createdAt, lte: dataBoundary },
          orderStatus: { in: ["confirmed", "packed", "delivered"] },
        },
        include: { soldItems: { include: { stock: true } }, refunds: true },
      });

      let totalProfit = 0;
      const byDate: Record<string, number> = {};
      const hourly: Record<number, number> = {};

      for (const o of orders) {
        const p = calcProfit(o);
        totalProfit += p;

        // FIX: UTC slice এর বদলে local date-key
        const dateKey = toLocalDateKey(o.createdAt);
        byDate[dateKey] = (byDate[dateKey] || 0) + p;

        if (o.createdAt >= today) {
          const h = o.createdAt.getHours();
          hourly[h] = (hourly[h] || 0) + p;
        }
      }

      // ---------- Daily series: FULL ROUTE (start -> estimatedEndDate) ----------
      const dailySeries: { date: string; profit: number | null }[] = [];
      let cursor = new Date(campaignStartDay);
      while (cursor <= campaignEndDay) {
        // FIX: এখানেও local date-key, boundary comparison-এর সাথে consistent
        const key = toLocalDateKey(cursor);
        const hasHappened = cursor <= dataBoundaryDay;
        dailySeries.push({
          date: key,
          profit: hasHappened ? round2(byDate[key] || 0) : null,
        });
        cursor = addDays(cursor, 1);
      }

      // ---------- Hourly series: FULL 0-23, aajker jonno ----------
      const campaignStartedToday =
        campaignStartDay.getTime() === today.getTime();
      const startHour = campaignStartedToday
        ? campaign.createdAt.getHours()
        : 0;

      const dataBoundaryIsToday = dataBoundaryDay.getTime() === today.getTime();
      const endHour = dataBoundaryIsToday ? dataBoundary.getHours() : -1;

      const hourlySeries: { hour: number; profit: number | null }[] = [];
      for (let h = 0; h < 24; h++) {
        const withinWindow = h >= startHour && h <= endHour;
        hourlySeries.push({
          hour: h,
          profit: withinWindow ? round2(hourly[h] || 0) : null,
        });
      }

      const todayProfit = round2(
        Object.entries(hourly).reduce((sum, [, v]) => sum + v, 0),
      );

      res.json({
        success: true,
        data: {
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          perDayBudget: campaign.perDayBudget,
          estimatedEndDate: campaign.estimatedEndDate,
          maxPick: campaign.perDayBudget * 4,
          totalProfit: round2(totalProfit),
          todayProfit,
          dailySeries,
          hourlySeries,
        },
      });
    } catch (error: any) {
      console.error("Campaign history error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
