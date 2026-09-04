// src/controllers/worksheetController.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export const worksheetController = {
  // GET all (admin) with pagination & search
  async getAllAdmin(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search ? { title: { contains: search.trim() } } : {};

      const [worksheets, total] = await Promise.all([
        prisma.worksheet.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.worksheet.count({ where }),
      ]);

      res.json({
        success: true,
        data: worksheets,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET all (public) – no authentication, pagination + search
  async getAllPublic(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search ? { title: { contains: search.trim() } } : {};

      const [worksheets, total] = await Promise.all([
        prisma.worksheet.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            filePath: true,
            createdAt: true,
          },
        }),
        prisma.worksheet.count({ where }),
      ]);

      res.json({
        success: true,
        data: worksheets,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET single worksheet by ID
  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const worksheet = await prisma.worksheet.findUnique({ where: { id } });
      if (!worksheet) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      res.json({ success: true, data: worksheet });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ FORCE DOWNLOAD – Content-Disposition header দিয়ে browser কে বাধ্য করে download করতে (public, no auth)
  async downloadFile(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid worksheet ID" });
      }

      const worksheet = await prisma.worksheet.findUnique({ where: { id } });
      if (!worksheet) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      const filename = worksheet.filePath.split("/").pop();
      if (!filename) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid file path" });
      }

      const filePath = path.join(
        process.cwd(),
        "public/uploads/worksheets",
        filename,
      );

      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json({ success: false, message: "File not found on server" });
      }

      // safe filename বানানো — title থেকে special characters সরিয়ে
      const safeTitle =
        worksheet.title.replace(/[^a-zA-Z0-9\u0980-\u09FF\s-]/g, "").trim() ||
        "worksheet";

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.pdf"`,
      );
      res.setHeader("Content-Type", "application/pdf");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Download error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // CREATE – full URL store (like product images)
  async create(req: Request, res: Response) {
    try {
      const { title } = req.body;
      const file = (req as any).file;

      if (!title || !title.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Title required" });
      }
      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "PDF file required" });
      }

      // ✅ full URL – exactly like product thumbnail
      const fullPath = `${req.protocol}://${req.get("host")}/uploads/worksheets/${file.filename}`;

      const worksheet = await prisma.worksheet.create({
        data: {
          title: title.trim(),
          filePath: fullPath,
        },
      });

      res.status(201).json({ success: true, data: worksheet });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // UPDATE – replace file if new one uploaded
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { title } = req.body;
      const file = (req as any).file;

      const existing = await prisma.worksheet.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      const updateData: any = {};
      if (title && title.trim()) {
        updateData.title = title.trim();
      }

      // If new file uploaded, delete old file and update path
      if (file) {
        // Delete old file if exists (filename বের করে নেওয়া হচ্ছে, full URL বা relative path যেটাই থাকুক)
        if (existing.filePath) {
          const oldFilename = existing.filePath.split("/").pop();
          if (oldFilename) {
            const oldPath = path.join(
              process.cwd(),
              "public/uploads/worksheets",
              oldFilename,
            );
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
        }
        // ✅ full URL – exactly like product thumbnail
        updateData.filePath = `${req.protocol}://${req.get("host")}/uploads/worksheets/${file.filename}`;
      }

      const updated = await prisma.worksheet.update({
        where: { id },
        data: updateData,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // DELETE – removes file and database record
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const existing = await prisma.worksheet.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      // Delete file if exists (filename বের করে নেওয়া হচ্ছে)
      if (existing.filePath) {
        const filename = existing.filePath.split("/").pop();
        if (filename) {
          const filePath = path.join(
            process.cwd(),
            "public/uploads/worksheets",
            filename,
          );
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      await prisma.worksheet.delete({ where: { id } });

      res.json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
