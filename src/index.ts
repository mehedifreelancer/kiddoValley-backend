import express, { Request, Response, NextFunction } from "express";
import cors from 'cors';
import dotenv from "dotenv";
import swaggerUi from 'swagger-ui-express';
import { prisma } from "./lib/prisma";
import { swaggerSpec } from "./config/swagger";

// Import routes
import adminCategoryRoutes from "./routes/admin/categories";
import adminProductRoutes from "./routes/admin/products";
import publicCategoryRoutes from "./routes/public/categories";
import publicProductRoutes from "./routes/public/products";
import adminAuthRoutes from './routes/admin/auth';
import adminBarcodeRoutes from './routes/admin/barcodes';

// Import middleware
import { adminAuth } from "./middleware/adminAuth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'), false); // ✅ Fixed: pass both arguments
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight for all routes
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/kiddoValley-api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Kiddo Valley API Docs',
}));

// ==================== ROUTES ====================
// Public routes
app.use("/api/public", publicCategoryRoutes);
app.use("/api/public", publicProductRoutes);

// Admin routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use("/api/admin", adminAuth, adminCategoryRoutes);
app.use("/api/admin/products", adminAuth, adminProductRoutes);
app.use('/api/admin', adminAuth, adminBarcodeRoutes);

// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Kiddo Valley API",
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

// Start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`✅ Kiddo Valley API running at http://localhost:${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/kiddoValley-api-docs`);
      console.log(`🔐 Auth: http://localhost:${PORT}/api/admin/auth`);
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