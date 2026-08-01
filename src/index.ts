import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { prisma } from "./lib/prisma";
import { swaggerSpec } from "./config/swagger";
import emailRoutes from "./routes/public/email";
import customerRoutes from "./routes/admin/customers";
import supplierRoutes from "./routes/admin/suppliers";
import sliderRoutes from "./routes/admin/heroBannerSlider";

// Import routes
import adminCategoryRoutes from "./routes/admin/categories";
import adminProductRoutes from "./routes/admin/products";
import publicCategoryRoutes from "./routes/public/categories";
import publicProductRoutes from "./routes/public/products";
import adminAuthRoutes from "./routes/admin/auth";
import adminBarcodeRoutes from "./routes/admin/barcodes";
import adminStockRoutes from "./routes/admin/stock";
import manufactureRoutes from "./routes/admin/manufactures";
import attributeRoutes from "./routes/admin/attributes";
import adminVariantRoutes from "./routes/admin/variant";
import adminOrderRoutes from "./routes/admin/orders";
import pathaoRoutes from "./routes/admin/pathao";
import webSettingsRoutes from "./routes/admin/webSettings";
import adminHeroSliderRoutes from "./routes/admin/heroSliders";
import publicHeroSliderRoutes from "./routes/public/heroSliders";
import publicOrderRoutes from "./routes/public/orders";
import publicWebSettingsRoutes from "./routes/public/webSettings";
import publicStockRoutes from "./routes/public/stock";

// Import middleware
import { adminAuth } from "./middleware/adminAuth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5174",
  "http://localhost:4000",
  "http://192.168.137.1:3000/",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow: boolean) => void,
  ) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    if (
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === "development"
    ) {
      callback(null, true);
    } else {
      console.log("Blocked origin:", origin);
      callback(new Error("Not allowed by CORS"), false); // ✅ Fixed: pass both arguments
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight for all routes
app.options("*", cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("public/uploads"));

// Swagger UI
app.use(
  "/kiddoValley-api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Kiddo Valley API Docs",
  }),
);

// ==================== ROUTES ====================
// Public routes
app.use("/api/public", publicCategoryRoutes);
app.use("/api/public", publicProductRoutes);
app.use("/api/public/email", emailRoutes); // Admin routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/categories", adminAuth, adminCategoryRoutes);
app.use("/api/admin/products", adminAuth, adminProductRoutes);
app.use("/api/admin", adminAuth, adminBarcodeRoutes);
app.use("/api/admin/stock", adminAuth, adminStockRoutes);
app.use("/api/public/stock", publicStockRoutes);
app.use("/api/admin/manufactures", adminAuth, manufactureRoutes);
app.use("/api/admin/attributes", adminAuth, attributeRoutes);
app.use("/api/admin/variant", adminAuth, adminVariantRoutes);
app.use("/api/admin/orders", adminAuth, adminOrderRoutes);
app.use("/api/public/orders", publicOrderRoutes);
app.use("/api/admin/pathao", pathaoRoutes);
app.use("/api/admin/customers", adminAuth, customerRoutes);
app.use("/api/admin/suppliers", adminAuth, supplierRoutes);
app.use("/api/admin/web-settings", adminAuth, webSettingsRoutes);
app.use("/api/public/web-settings", publicWebSettingsRoutes);
app.use("/api/admin/banner-sliders", adminAuth, sliderRoutes);
app.use("/api/admin/hero-sliders", adminAuth, adminHeroSliderRoutes);
app.use("/api/public/hero-sliders", publicHeroSliderRoutes);

// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Kiddo Valley API 1",
    version: "1.0.0",
    docs: "http://localhost:4000/kiddoValley-api-docs",
  });
});

// Test DB route
app.get("/api/test-db", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: "Database connected!" });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// Start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    app.listen(PORT, () => {
      console.log(`✅ Kiddo Valley API running at http://localhost:${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/kiddoValley-api-docs`);
      console.log(`🔐 Auth: http://localhost:${PORT}/api/admin/auth`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
