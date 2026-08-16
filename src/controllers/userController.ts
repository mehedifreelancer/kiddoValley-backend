import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const userController = {
  async getUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      // ✅ Build where clause – remove `mode: "insensitive"`
      let where: any = {};
      if (search) {
        where = {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { username: { contains: search } },
          ],
        };
      }

      const [data, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error("Get users error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createUser(req: Request, res: Response) {
    try {
      const { username, email, password, name, role } = req.body;
      if (!username || !email || !password || !name) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      // Check if username or email already exists
      const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Username or email already taken" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          name,
          role: role || "data_accountant",
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
      res.status(201).json({ success: true, data: user });
    } catch (error: any) {
      console.error("Create user error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, email, role, isActive, password } = req.body;

      const updateData: any = { name, email, role, isActive };
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters",
          });
        }
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
      res.json({ success: true, data: user });
    } catch (error: any) {
      console.error("Update user error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      // Prevent deleting yourself
      const currentUser = (req as any).user;
      if (currentUser.id === id) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot delete yourself" });
      }
      await prisma.user.delete({ where: { id } });
      res.json({ success: true, message: "User deleted" });
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
