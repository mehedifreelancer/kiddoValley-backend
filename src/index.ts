import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";

// Import routes
import categoryRoutes from "./routes/admin/categories";
import productRoutes from "./routes/admin/products";
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

// Public routes
app.use("/api/public/products", publicProductRoutes);

// Admin routes (protected)
app.use("/api/admin/categories", adminAuth, categoryRoutes);
app.use("/api/admin/products", adminAuth, productRoutes);

// Test route
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Kiddo Valley API",
    version: "1.0.0",
    endpoints: {
      public: {
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
          list: "GET /api/admin/categories",
          get: "GET /api/admin/categories/:id",
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

// Start server
app.listen(PORT, () => {
  console.log(`✅ Kiddo Valley API running at http://localhost:${PORT}`);
  console.log(`📚 Public API: http://localhost:${PORT}/api/public/products`);
  console.log(`🔧 Admin API: http://localhost:${PORT}/api/admin/categories`);
});

// export async function checkDatabaseConnection() {
//   try {
//     await prisma.$queryRaw`SELECT 1`;
//     console.log("✅ Database connection successful");
//     return true;
//   } catch (error) {
//     console.error("❌ Database connection failed:", error);
//     return false;
//   }
// }
// checkDatabaseConnection();
// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
