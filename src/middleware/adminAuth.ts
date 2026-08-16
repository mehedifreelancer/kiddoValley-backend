// src/middleware/adminAuth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Please login first.",
    });
  }

  const token = authHeader.split(" ")[1];
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;

  if (!accessSecret) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error",
    });
  }

  try {
    const decoded = jwt.verify(token, accessSecret as jwt.Secret) as {
      id: number;
      email: string;
      role: string;
    };

    // ✅ শুধু ডিকোড করে req.user-এ সেট করুন, রোল চেক করবেন না
    (req as any).user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token. Please login again.",
    });
  }
};
