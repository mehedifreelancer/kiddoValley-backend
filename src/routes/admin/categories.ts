import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { generateSlug } from "../../utils/slugify";

const router = Router();

// Get all categories
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get category by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id: Number(id) },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            barcode: true,
            sellingPrice: true,
            isForceOrder: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Create category
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const slug = generateSlug(name);

    const category = await prisma.category.create({
      data: { name, slug },
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
});

// Update category
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const slug = generateSlug(name);

    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: { name, slug },
    });

    res.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
});

// Delete category
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.category.delete({
      where: { id: Number(id) },
    });

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    if (error.code === "P2003") {
      res.status(400).json({
        success: false,
        message: "Cannot delete category with products",
      });
    } else if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Category not found",
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
