import { Request, Response } from "express";
import { generateSlug } from "../utils/slugify";
import { prisma } from "../lib/prisma";

export const categoryController = {
  // Get all categories (admin - with pagination & search)
  async getAllAdmin(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const skip = (page - 1) * limit;

      let where: any = {};

      if (search && search.trim() !== "") {
        const searchTerm = search.trim();
        where.OR = [
          { name: { contains: searchTerm } },
          { slug: { contains: searchTerm } },
        ];
      }

      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          skip,
          take: limit,
          include: {
            _count: {
              select: { products: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.category.count({ where }),
      ]);

      const formattedCategories = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productCount: cat._count.products,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }));

      res.json({
        success: true,
        data: formattedCategories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Get all categories admin error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch categories",
      });
    }
  },

  // Get all categories (public)
  async getAll(req: Request, res: Response) {
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

      const formattedCategories = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productCount: cat._count.products,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }));

      res.json({
        success: true,
        data: formattedCategories,
      });
    } catch (error: any) {
      console.error("Get all categories error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch categories",
      });
    }
  },

  // Get category by ID
  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              // barcode removed (moved to variant)
              isForceOrder: true,
              // sellingPrice removed (now in Stock table)
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
      console.error("Get category by ID error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch category",
      });
    }
  },

  // Get category by slug
  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      const category = await prisma.category.findUnique({
        where: { slug },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              slug: true,
              isForceOrder: true,
              // barcode removed (moved to variant)
              // sellingPrice removed
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
      console.error("Get category by slug error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch category",
      });
    }
  },

  // Create category
  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Category name must be at least 2 characters",
        });
      }

      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Category name must be less than 50 characters",
        });
      }

      const slug = generateSlug(name);

      const existingCategory = await prisma.category.findFirst({
        where: {
          OR: [{ name: name.trim() }, { slug }],
        },
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }

      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          slug,
        },
      });

      res.status(201).json({
        success: true,
        data: category,
        message: "Category created successfully",
      });
    } catch (error: any) {
      console.error("Create category error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create category",
      });
    }
  },

  // Update category
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Category name must be at least 2 characters",
        });
      }

      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Category name must be less than 50 characters",
        });
      }

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      const slug = generateSlug(name);

      const duplicateCategory = await prisma.category.findFirst({
        where: {
          name: name.trim(),
          id: { not: id },
        },
      });

      if (duplicateCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          name: name.trim(),
          slug,
        },
      });

      res.json({
        success: true,
        data: category,
        message: "Category updated successfully",
      });
    } catch (error: any) {
      console.error("Update category error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update category",
      });
    }
  },

  // Delete category
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      if (category._count.products > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category with ${category._count.products} products. Delete or reassign products first.`,
        });
      }

      await prisma.category.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete category error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete category",
      });
    }
  },
};
