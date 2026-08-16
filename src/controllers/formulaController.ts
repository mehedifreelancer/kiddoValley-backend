import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const formulaController = {
  async getFormulas(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search
        ? { title: { contains: search } } // ✅ removed `mode: "insensitive"`
        : {};

      const [data, total] = await Promise.all([
        prisma.formula.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.formula.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error("Get formulas error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createFormula(req: Request, res: Response) {
    try {
      const { title, content, images } = req.body;
      if (!title || !content) {
        return res
          .status(400)
          .json({ success: false, message: "Title and content are required" });
      }
      const formula = await prisma.formula.create({
        data: {
          title,
          content,
          images: images || [],
        },
      });
      res.status(201).json({ success: true, data: formula });
    } catch (error: any) {
      console.error("Create formula error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateFormula(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { title, content, images } = req.body;
      const formula = await prisma.formula.update({
        where: { id },
        data: { title, content, images: images || [] },
      });
      res.json({ success: true, data: formula });
    } catch (error: any) {
      console.error("Update formula error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteFormula(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await prisma.formula.delete({ where: { id } });
      res.json({ success: true, message: "Formula deleted" });
    } catch (error: any) {
      console.error("Delete formula error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
