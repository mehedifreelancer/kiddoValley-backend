import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { generateSlug } from "../../utils/slugify";

const router = Router();

// Get all products
router.get("/", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
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

// Get product by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: { category: true },
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

// Get product by barcode
router.get("/barcode/:barcode", async (req, res) => {
  try {
    const { barcode } = req.params;

    const product = await prisma.product.findUnique({
      where: { barcode },
      include: { category: true },
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

// Create product
router.post("/", async (req, res) => {
  try {
    const {
      barcode,
      name,
      categoryId,
      buyingPrice,
      sellingPrice,
      videoUrl,
      isForceOrder,
      forceOrderPriority,
      hasDiscount,
      discountPercent,
      stockQuantity,
    } = req.body;

    // Validation
    if (!barcode || !name || !categoryId || !buyingPrice || !sellingPrice) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Check if barcode exists
    const existingProduct = await prisma.product.findUnique({
      where: { barcode },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this barcode already exists",
      });
    }

    const slug = generateSlug(name);

    const product = await prisma.product.create({
      data: {
        barcode,
        name,
        slug,
        videoUrl,
        isForceOrder: isForceOrder || false,
        forceOrderPriority: forceOrderPriority || 0,
        categoryId,
        buyingPrice,
        sellingPrice,
        hasDiscount: hasDiscount || false,
        discountPercent,
        stockQuantity: stockQuantity || 0,
      },
      include: {
        category: true,
      },
    });

    res.status(201).json({
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

// Update product
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If name is updated, regenerate slug
    if (updateData.name) {
      updateData.slug = generateSlug(updateData.name);
    }

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: updateData,
      include: { category: true },
    });

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
});

// Delete product
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id: Number(id) },
    });

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
});

export default router;
