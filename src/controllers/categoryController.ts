import { Request, Response } from 'express';
import { generateSlug } from '../utils/slugify';
import { prisma } from '../lib/prisma';



export const categoryController = {
  // Get all categories
  async getAll(req: Request, res: Response) {
    try {
      const categories = await prisma.category.findMany({
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const formattedCategories = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productCount: cat._count.products,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
      }));

      res.json({
        success: true,
        data: formattedCategories
      });
    } catch (error: any) {
      console.error('Get all categories error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch categories'
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
          message: 'Invalid category ID'
        });
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              barcode: true,
              sellingPrice: true,
              isForceOrder: true,
              stockQuantity: true
            }
          }
        }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error: any) {
      console.error('Get category by ID error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch category'
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
              barcode: true,
              slug: true,
              sellingPrice: true,
              isForceOrder: true
            }
          }
        }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error: any) {
      console.error('Get category by slug error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch category'
      });
    }
  },

  // Create category
  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be at least 2 characters'
        });
      }

      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be less than 50 characters'
        });
      }

      const slug = generateSlug(name);

      const existingCategory = await prisma.category.findFirst({
        where: {
          OR: [
            { name: name.trim() },
            { slug }
          ]
        }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }

      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          slug
        }
      });

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully'
      });
    } catch (error: any) {
      console.error('Create category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create category'
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
          message: 'Invalid category ID'
        });
      }

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be at least 2 characters'
        });
      }

      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be less than 50 characters'
        });
      }

      const existingCategory = await prisma.category.findUnique({
        where: { id }
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const slug = generateSlug(name);

      const duplicateCategory = await prisma.category.findFirst({
        where: {
          name: name.trim(),
          id: { not: id }
        }
      });

      if (duplicateCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          name: name.trim(),
          slug
        }
      });

      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully'
      });
    } catch (error: any) {
      console.error('Update category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update category'
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
          message: 'Invalid category ID'
        });
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      if (category._count.products > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category with ${category._count.products} products. Delete or reassign products first.`
        });
      }

      await prisma.category.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete category'
      });
    }
  }
};