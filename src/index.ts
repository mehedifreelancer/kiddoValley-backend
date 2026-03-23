import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";

// Import routes
import adminCategoryRoutes from "./routes/admin/categories";
import adminProductRoutes from "./routes/admin/products";
import publicCategoryRoutes from "./routes/public/categories";
import publicProductRoutes from "./routes/public/products";

// Import middleware
import { adminAuth } from "./middleware/adminAuth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Manual CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-admin-key",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Public routes (no auth)
app.use("/api/public/categories", publicCategoryRoutes);
app.use("/api/public/products", publicProductRoutes);

// Admin routes (protected)
app.use("/api/admin/categories", adminAuth, adminCategoryRoutes);
app.use("/api/admin/products", adminAuth, adminProductRoutes);

// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Kiddo Valley API",
    version: "1.0.0",
    endpoints: {
      public: {
        categories: {
          list: "GET /api/public/categories",
          get: "GET /api/public/categories/:id",
          getBySlug: "GET /api/public/categories/slug/:slug",
        },
        products: {
          list: "GET /api/public/products?page=1&limit=10",
          byBarcode: "GET /api/public/products/barcode/:barcode",
          bySlug: "GET /api/public/products/:slug",
          forceOrder: "GET /api/public/products/force-order/all",
        },
      },
      admin: {
        categories: {
          create: "POST /api/admin/categories",
          update: "PUT /api/admin/categories/:id",
          delete: "DELETE /api/admin/categories/:id",
        },
        products: {
          create: "POST /api/admin/products",
          list: "GET /api/admin/products",
          byBarcode: "GET /api/admin/products/barcode/:barcode",
          update: "PUT /api/admin/products/:id",
          delete: "DELETE /api/admin/products/:id",
        },
      },
    },
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
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server with DB check
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`✅ Kiddo Valley API running at http://localhost:${PORT}`);
      console.log(`📚 Public Categories: http://localhost:${PORT}/api/public/categories`);
      console.log(`📚 Public Products: http://localhost:${PORT}/api/public/products`);
      console.log(`🔧 Admin API: http://localhost:${PORT}/api/admin`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log('\n👋 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});