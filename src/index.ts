import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import swaggerUi from 'swagger-ui-express';
import { prisma } from "./lib/prisma";
import { swaggerSpec } from "./config/swagger";

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

// Swagger UI - Custom URL
app.use('/kiddoValley-api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Kiddo Valley API Docs',
}));

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

// ==================== PUBLIC ROUTES ====================
// No authentication required
app.use("/api/public", publicCategoryRoutes);
app.use("/api/public", publicProductRoutes);

// ==================== ADMIN ROUTES ====================
// Require admin authentication
app.use("/api/admin", adminAuth, adminCategoryRoutes);
app.use("/api/admin", adminAuth, adminProductRoutes);

// ==================== HEALTH & TEST ROUTES ====================
// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Kiddo Valley API",
    version: "1.0.0",
    docs: "http://localhost:4000/kiddoValley-api-docs",
    endpoints: {
      public: {
        categories: {
          list: "GET /api/public/categories",
          getById: "GET /api/public/category/:id",
          getBySlug: "GET /api/public/category/:slug",
        },
        products: {
          list: "GET /api/public/products?page=1&limit=10",
          getBySlug: "GET /api/public/product/:slug",
          getByBarcode: "GET /api/public/product/barcode/:barcode",
          forceOrder: "GET /api/public/products/force-order",
        },
      },
      admin: {
        categories: {
          create: "POST /api/admin/createCategory",
          update: "PUT /api/admin/editCategory/:id",
          delete: "DELETE /api/admin/deleteCategory/:id",
        },
        products: {
          create: "POST /api/admin/createProduct",
          list: "GET /api/admin/products",
          getById: "GET /api/admin/product/:id",
          getByBarcode: "GET /api/admin/product/barcode/:barcode",
          update: "PUT /api/admin/editProduct/:id",
          delete: "DELETE /api/admin/deleteProduct/:id",
        },
      },
      docs: "GET /kiddoValley-api-docs",
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
      console.log(`📚 API Docs: http://localhost:${PORT}/kiddoValley-api-docs`);
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