import { Request, Response } from 'express';
import { generateSlug } from '../utils/slugify';
import { prisma } from '../lib/prisma';

export const productController = {
  // Get all products (public with pagination)
  async getAllPublic(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const category = req.query.category as string;
      const forceOrder = req.query.forceOrder === 'true';
      
      const skip = (page - 1) * limit;
      
      let where: any = {};
      if (search) {
        where.name = { contains: search };
      }
      if (category) {
        where.category = { slug: category };
      }
      if (forceOrder) {
        where.isForceOrder = true;
      }
      
      const products = await prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: forceOrder 
          ? { forceOrderPriority: 'desc' }
          : { createdAt: 'desc' }
      });
      
      const total = await prisma.product.count({ where });
      
      res.json({
        success: true,
        data: products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      console.error('Get all products error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch products'
      });
    }
  },

  // Get all products (admin - full access)
  async getAllAdmin(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      console.error('Get all products admin error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch products'
      });
    }
  },

  // Get product by ID
  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID'
        });
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      console.error('Get product by ID error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch product'
      });
    }
  },

  // Get product by slug
  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      const product = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      console.error('Get product by slug error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch product'
      });
    }
  },

  // Get product by barcode
  async getByBarcode(req: Request, res: Response) {
    try {
      const { barcode } = req.params;

      const product = await prisma.product.findUnique({
        where: { barcode },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      console.error('Get product by barcode error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch product'
      });
    }
  },

  // Get force order products
  async getForceOrder(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        where: { isForceOrder: true },
        orderBy: { forceOrderPriority: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      console.error('Get force order products error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch force order products'
      });
    }
  },

  // Create product
  async create(req: Request, res: Response) {
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
          message: 'Missing required fields: barcode, name, categoryId, buyingPrice, sellingPrice'
        });
      }

      if (typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Valid barcode is required'
        });
      }

      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Product name is required'
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Product name must be at least 2 characters'
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Product name must be less than 100 characters'
        });
      }

      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid category ID is required'
        });
      }

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Check if barcode exists
      const existingProduct = await prisma.product.findUnique({
        where: { barcode }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists'
        });
      }

      const slug = generateSlug(name);

      // Check if slug exists
      const existingSlug = await prisma.product.findUnique({
        where: { slug }
      });

      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: 'Product with this name already exists'
        });
      }

      const product = await prisma.product.create({
        data: {
          barcode: barcode.trim(),
          name: name.trim(),
          slug,
          videoUrl: videoUrl || null,
          isForceOrder: isForceOrder || false,
          forceOrderPriority: forceOrderPriority || 0,
          categoryId,
          buyingPrice,
          sellingPrice,
          hasDiscount: hasDiscount || false,
          discountPercent: discountPercent || null,
          stockQuantity: stockQuantity || 0,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error: any) {
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create product'
      });
    }
  },

  // Update product
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID'
        });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // If name is updated, regenerate slug
      if (updateData.name) {
        if (updateData.name.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Product name must be at least 2 characters'
          });
        }
        updateData.slug = generateSlug(updateData.name);
        
        // Check if new slug conflicts with another product
        const existingSlug = await prisma.product.findFirst({
          where: {
            slug: updateData.slug,
            id: { not: id }
          }
        });
        
        if (existingSlug) {
          return res.status(400).json({
            success: false,
            message: 'Product with this name already exists'
          });
        }
      }

      // If barcode is updated, check for duplicates
      if (updateData.barcode) {
        const existingBarcode = await prisma.product.findFirst({
          where: {
            barcode: updateData.barcode,
            id: { not: id }
          }
        });
        
        if (existingBarcode) {
          return res.status(400).json({
            success: false,
            message: 'Product with this barcode already exists'
          });
        }
      }

      const product = await prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error: any) {
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update product'
      });
    }
  },

  // Delete product
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID'
        });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if product has any sale items
      const saleItems = await prisma.saleItem.findMany({
        where: { productId: id },
        take: 1
      });

      if (saleItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product with existing sales records'
        });
      }

      await prisma.product.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete product'
      });
    }
  }
};