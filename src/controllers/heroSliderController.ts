import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const heroSliderController = {
  // ---- Admin ----
  async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";

      const skip = (page - 1) * limit;
      let where: any = {};

      if (search) {
        where.OR = [
          { firstTitle: { contains: search } },
          { secondTitle: { contains: search } },
          { bookTitle: { contains: search } },
          { badgeText: { contains: search } },
        ];
      }

      const [slides, total] = await Promise.all([
        prisma.heroSlider.findMany({
          where,
          skip,
          take: limit,
          orderBy: { order: "asc" },
        }),
        prisma.heroSlider.count({ where }),
      ]);

      res.json({
        success: true,
        data: slides,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error("Get hero sliders error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = req.body;
      // Compute next order
      const maxOrder = await prisma.heroSlider.aggregate({
        _max: { order: true },
      });
      const order = (maxOrder._max.order ?? -1) + 1;
      const slide = await prisma.heroSlider.create({
        data: { ...data, order },
      });
      res.status(201).json({ success: true, data: slide });
    } catch (error: any) {
      console.error("Create hero slider error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const data = req.body;
      const slide = await prisma.heroSlider.update({
        where: { id },
        data,
      });
      res.json({ success: true, data: slide });
    } catch (error: any) {
      console.error("Update hero slider error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      await prisma.heroSlider.delete({ where: { id } });
      res.json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
      console.error("Delete hero slider error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async reorder(req: Request, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "ids array required" });
      }
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.heroSlider.update({
            where: { id },
            data: { order: index },
          }),
        ),
      );
      const updated = await prisma.heroSlider.findMany({
        orderBy: { order: "asc" },
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Reorder hero sliders error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---- Image Upload ----
  async uploadImage(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "No image file provided" });
      }
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const imageUrl = `${baseUrl}/uploads/hero-slider/${file.filename}`;
      res.json({ success: true, data: { url: imageUrl } });
    } catch (error: any) {
      console.error("Upload hero image error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ---- Public ----
  async getPublic(req: Request, res: Response) {
    try {
      const slides = await prisma.heroSlider.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });
      res.json({ success: true, data: slides });
    } catch (error: any) {
      console.error("Get public hero sliders error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
