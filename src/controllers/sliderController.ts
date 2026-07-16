import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import path from "path";
import fs from "fs";

// Helper to delete a file
function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("Failed to delete file:", filePath, e);
  }
}

export const sliderController = {
  // GET all sliders grouped by device
  async getSliders(req: Request, res: Response) {
    try {
      const sliders = await prisma.sliderImage.findMany({
        orderBy: [{ deviceType: "asc" }, { order: "asc" }],
      });
      const desktop = sliders.filter((s) => s.deviceType === "desktop");
      const mobile = sliders.filter((s) => s.deviceType === "mobile");
      res.json({ success: true, data: { desktop, mobile } });
    } catch (error: any) {
      console.error("Get sliders error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch sliders" });
    }
  },

  // POST add a slider image (upload file)
  async addSlider(req: Request, res: Response) {
    let filePath: string | null = null;
    try {
      const { deviceType } = req.body;
      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "No image file provided" });
      }
      if (!deviceType || !["desktop", "mobile"].includes(deviceType)) {
        // Delete uploaded file if deviceType invalid
        deleteFile(file.path);
        return res
          .status(400)
          .json({ success: false, message: "Invalid deviceType" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const imageUrl = `${baseUrl}/uploads/slider-images/${file.filename}`;

      // Get max order for this device
      const maxOrder = await prisma.sliderImage.aggregate({
        where: { deviceType },
        _max: { order: true },
      });
      const nextOrder = (maxOrder._max.order ?? -1) + 1;

      const newSlider = await prisma.sliderImage.create({
        data: {
          deviceType,
          imageUrl,
          order: nextOrder,
          isActive: true,
        },
      });

      res.status(201).json({ success: true, data: newSlider });
    } catch (error: any) {
      if (filePath) deleteFile(filePath);
      console.error("Add slider error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to add slider",
        });
    }
  },

  // PUT reorder sliders for a device (send array of ids in new order)
  async reorderSliders(req: Request, res: Response) {
    try {
      const { deviceType, ids } = req.body;
      if (!deviceType || !["desktop", "mobile"].includes(deviceType)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid deviceType" });
      }
      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "ids array required" });
      }

      // Update order for each id
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.sliderImage.update({
            where: { id },
            data: { order: index },
          }),
        ),
      );

      // Return updated list
      const updated = await prisma.sliderImage.findMany({
        where: { deviceType },
        orderBy: { order: "asc" },
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Reorder sliders error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to reorder sliders",
        });
    }
  },

  // DELETE a slider image
  async deleteSlider(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const slider = await prisma.sliderImage.findUnique({ where: { id } });
      if (!slider) {
        return res
          .status(404)
          .json({ success: false, message: "Slider not found" });
      }

      // Delete file from disk
      if (slider.imageUrl) {
        let relativePath = slider.imageUrl;
        if (relativePath.startsWith("http")) {
          const url = new URL(relativePath);
          relativePath = url.pathname;
        }
        const fullPath = path.join(process.cwd(), "public", relativePath);
        deleteFile(fullPath);
      }

      await prisma.sliderImage.delete({ where: { id } });
      res.json({ success: true, message: "Slider deleted" });
    } catch (error: any) {
      console.error("Delete slider error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to delete slider",
        });
    }
  },
};
