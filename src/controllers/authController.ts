// src/controllers/authController.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

// Generate Access Token (1 hour)
const generateAccessToken = (user: {
  id: number;
  email: string;
  role: string;
}) => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  if (!accessSecret) throw new Error("ACCESS_TOKEN_SECRET not configured");
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    accessSecret as jwt.Secret,
    { expiresIn: "1h" },
  );
};

// Generate Refresh Token (7 days)
const generateRefreshToken = (user: {
  id: number;
  email: string;
  role: string;
}) => {
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
  if (!refreshSecret) throw new Error("REFRESH_TOKEN_SECRET not configured");
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    refreshSecret as jwt.Secret,
    { expiresIn: "7d" },
  );
};

export const authController = {
  // Admin login
  async login(req: Request, res: Response) {
    try {
      const { usernameOrEmail, password } = req.body;

      if (!usernameOrEmail || !password) {
        return res.status(400).json({
          success: false,
          message: "Username/Email and password are required",
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated. Please contact admin.",
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to login",
      });
    }
  },

  // Refresh token endpoint
  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token required",
        });
      }

      const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
      if (!refreshSecret) {
        throw new Error("REFRESH_TOKEN_SECRET not configured");
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, refreshSecret as jwt.Secret) as {
        id: number;
        email: string;
        role: string;
      };

      // Check if user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      // Generate new access token (1 hour)
      const newAccessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // Optional: Rotate refresh token (generate new one for security)
      const newRefreshToken = generateRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error: any) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
  },

  // Logout – just return success (frontend will clear tokens)
  async logout(req: Request, res: Response) {
    try {
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to logout",
      });
    }
  },

  // Setup first admin user
  async setupAdmin(req: Request, res: Response) {
    try {
      const { username, name, email, password } = req.body;

      const existingAdmin = await prisma.user.findFirst({
        where: { role: "admin" },
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Admin user already exists",
        });
      }

      if (!username || !name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Username, name, email and password are required",
        });
      }

      if (username.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Username must be at least 3 characters",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const existingUsername = await prisma.user.findUnique({
        where: { username },
      });

      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = await prisma.user.create({
        data: {
          username,
          name,
          email,
          password: hashedPassword,
          role: "admin",
          isActive: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "Admin user created successfully",
        data: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error: any) {
      console.error("Setup admin error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create admin",
      });
    }
  },

  // ==================== ✅ Updated changePassword ====================
  async changePassword(req: Request, res: Response) {
    try {
      // ✅ 'req.user' from adminAuth (not req.admin)
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }

      // Find user in DB
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        dbUser.password,
      );

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to change password",
      });
    }
  },

  // Get profile (uses req.user)
  async getProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
        },
      });

      if (!dbUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: dbUser,
      });
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get profile",
      });
    }
  },
};
