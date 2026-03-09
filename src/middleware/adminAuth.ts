import { Request, Response, NextFunction } from "express";

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.headers["x-admin-key"];

  if (adminKey === process.env.ADMIN_SECRET_KEY) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: "Unauthorized - Invalid admin key",
    });
  }
};
