import { Router } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

// Get all products with pagination
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const search = req.query.search as string;
    const forceOrder = req.query.forceOrder === "true";

    const skip = (page - 1) * limit;

    // Build where clause
    let where: any = {};

    if (category) {
      where.category = {
        slug: category,
      };
    }

    if (search) {
      where.name = {
        contains: search,
      };
    }

    if (forceOrder) {
      where.isForceOrder = true;
    }

    // Get products
    const products = await prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: forceOrder
        ? { forceOrderPriority: "desc" }
        : { createdAt: "desc" },
    });

    // Get total count for pagination
    const total = await prisma.product.count({ where });

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get product by barcode (for scanning)
router.get("/barcode/:barcode", async (req, res) => {
  try {
    const { barcode } = req.params;

    const product = await prisma.product.findUnique({
      where: { barcode },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get product by slug
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get force order products
router.get("/force-order/all", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isForceOrder: true },
      orderBy: { forceOrderPriority: "desc" },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: products,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
