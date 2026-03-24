import { Request, Response } from 'express';
import path from 'path';
import { generateSlug } from '../utils/slugify';
import { prisma } from '../lib/prisma';
import { deleteFiles, getImagePathsFromProduct } from '../utils/fileUtils';
import { saveImagesToDisk } from '../multer';

export const productController = {
  // Get all products (public with pagination and search)
  async getAllPublic(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | string[];
      const category = req.query.category as string;
      const forceOrder = req.query.forceOrder === 'true';
      
      const skip = (page - 1) * limit;
      
      let where: any = {};
      
      if (search) {
        const searchTerms = Array.isArray(search) ? search : [search];
        where.AND = searchTerms.map(term => ({
          OR: [
            { name: { contains: term } },
            { barcode: { contains: term } }
          ]
        }));
      }
      
      if (category) {
        where.category = { slug: category };
      }
      if (forceOrder) {
        where.isForceOrder = true;
      }
      
      const [products, total] = await Promise.all([
        prisma.product.findMany({
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
        }),
        prisma.product.count({ where })
      ]);
      
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

  // Get all products (admin - full access with search)
  async getAllAdmin(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | string[];
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const forceOrder = req.query.forceOrder === 'true';
      
      const skip = (page - 1) * limit;
      
      let where: any = {};
      
      if (search) {
        const searchTerms = Array.isArray(search) ? search : [search];
        where.AND = searchTerms.map(term => ({
          OR: [
            { name: { contains: term } },
            { barcode: { contains: term } },
            { slug: { contains: term } }
          ]
        }));
      }
      
      if (categoryId) {
        where.categoryId = categoryId;
      }
      
      if (forceOrder) {
        where.isForceOrder = true;
      }
      
      const [products, total] = await Promise.all([
        prisma.product.findMany({
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
        }),
        prisma.product.count({ where })
      ]);
      
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

  // Get categories for dropdown
  async getCategoriesForDropdown(req: Request, res: Response) {
    try {
      const categories = await prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      res.json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch categories'
      });
    }
  },

  // Get barcodes for dropdown
  async getBarcodesForDropdown(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          barcode: true,
          name: true
        },
        orderBy: {
          barcode: 'asc'
        }
      });

      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      console.error('Get barcodes error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch barcodes'
      });
    }
  },

  // Create product - validate first, then save images, then save to DB
  async create(req: Request, res: Response) {
    let savedFilenames: string[] = [];
    
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

      const files = req.files as Express.Multer.File[];

      // ==================== VALIDATION PHASE ====================
      // No images saved yet - all validation happens first

      // 1. Validate images - at least one image required
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one product image is required'
        });
      }

      // 2. Validate barcode
      if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Valid barcode is required'
        });
      }

      // 3. Validate name
      if (!name || typeof name !== 'string' || name.trim() === '') {
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

      // 4. Validate category
      const categoryIdNum = parseInt(categoryId);
      if (isNaN(categoryIdNum)) {
        return res.status(400).json({
          success: false,
          message: 'Valid category ID is required'
        });
      }

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id: categoryIdNum }
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category not found'
        });
      }

      // 5. Check if barcode exists
      const existingProduct = await prisma.product.findUnique({
        where: { barcode: barcode.trim() }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists'
        });
      }

      const slug = generateSlug(name);

      // 6. Check if slug exists
      const existingSlug = await prisma.product.findUnique({
        where: { slug }
      });

      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: 'Product with this name already exists'
        });
      }

      // 7. Validate prices
      const buyingPriceNum = parseFloat(buyingPrice);
      const sellingPriceNum = parseFloat(sellingPrice);
      
      if (isNaN(buyingPriceNum) || isNaN(sellingPriceNum)) {
        return res.status(400).json({
          success: false,
          message: 'Valid buying price and selling price are required'
        });
      }

      // ==================== SAVE IMAGES PHASE ====================
      // All validation passed, now save images to disk
      savedFilenames = saveImagesToDisk(files);

      // Create image URLs
      const images = savedFilenames.map(filename => ({
        imgUrl: `${req.protocol}://${req.get('host')}/uploads/product-images/${filename}`
      }));

      // ==================== SAVE TO DATABASE PHASE ====================
      const product = await prisma.product.create({
        data: {
          barcode: barcode.trim(),
          name: name.trim(),
          slug,
          videoUrl: videoUrl || null,
          images,
          isForceOrder: isForceOrder === 'true' || isForceOrder === true,
          forceOrderPriority: parseInt(forceOrderPriority) || 0,
          categoryId: categoryIdNum,
          buyingPrice: buyingPriceNum,
          sellingPrice: sellingPriceNum,
          hasDiscount: hasDiscount === 'true' || hasDiscount === true,
          discountPercent: discountPercent ? parseFloat(discountPercent) : null,
          stockQuantity: parseInt(stockQuantity) || 0,
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
      // ==================== CLEANUP PHASE ====================
      // If anything fails, delete any saved images
      if (savedFilenames.length > 0) {
        const imagePaths = savedFilenames.map(filename => 
          path.join(process.cwd(), 'public/uploads/product-images', filename)
        );
        deleteFiles(imagePaths);
        console.log(`🧹 Cleaned up ${savedFilenames.length} orphaned image(s)`);
      }
      
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create product'
      });
    }
  },

  // Update product - validate first, then handle images
  async update(req: Request, res: Response) {
    let savedFilenames: string[] = [];
    let oldImagePaths: string[] = [];
    
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

      const updateData: any = { ...req.body };
      const files = req.files as Express.Multer.File[];

      // Store old image paths for potential cleanup
      const oldImages = existingProduct.images as any[];
      if (oldImages && oldImages.length > 0) {
        oldImagePaths = getImagePathsFromProduct(oldImages);
      }

      // ==================== VALIDATION PHASE ====================
      
      // If name is updated, validate and regenerate slug
      if (updateData.name) {
        if (updateData.name.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Product name must be at least 2 characters'
          });
        }
        if (updateData.name.length > 100) {
          return res.status(400).json({
            success: false,
            message: 'Product name must be less than 100 characters'
          });
        }
        updateData.slug = generateSlug(updateData.name);
        
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

      // ==================== SAVE NEW IMAGES PHASE ====================
      // If new images are uploaded, save them first
      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        
        // Create new image URLs
        const newImages = savedFilenames.map(filename => ({
          imgUrl: `${req.protocol}://${req.get('host')}/uploads/product-images/${filename}`
        }));
        updateData.images = newImages;
      }

      // Parse numeric fields
      if (updateData.categoryId) updateData.categoryId = parseInt(updateData.categoryId);
      if (updateData.buyingPrice) updateData.buyingPrice = parseFloat(updateData.buyingPrice);
      if (updateData.sellingPrice) updateData.sellingPrice = parseFloat(updateData.sellingPrice);
      if (updateData.forceOrderPriority) updateData.forceOrderPriority = parseInt(updateData.forceOrderPriority);
      if (updateData.stockQuantity) updateData.stockQuantity = parseInt(updateData.stockQuantity);
      if (updateData.discountPercent) updateData.discountPercent = parseFloat(updateData.discountPercent);
      
      // Convert boolean fields
      if (updateData.isForceOrder !== undefined) {
        updateData.isForceOrder = updateData.isForceOrder === 'true' || updateData.isForceOrder === true;
      }
      if (updateData.hasDiscount !== undefined) {
        updateData.hasDiscount = updateData.hasDiscount === 'true' || updateData.hasDiscount === true;
      }

      // ==================== UPDATE DATABASE PHASE ====================
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

      // ==================== DELETE OLD IMAGES PHASE ====================
      // Only delete old images if update was successful and new images were uploaded
      if (savedFilenames.length > 0 && oldImagePaths.length > 0) {
        const result = deleteFiles(oldImagePaths);
        console.log(`✅ Deleted ${result.success} old image(s), failed: ${result.failed}`);
      }

      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error: any) {
      // ==================== CLEANUP PHASE ====================
      // If update fails, delete any newly saved images
      if (savedFilenames.length > 0) {
        const newImagePaths = savedFilenames.map(filename => 
          path.join(process.cwd(), 'public/uploads/product-images', filename)
        );
        deleteFiles(newImagePaths);
        console.log(`🧹 Cleaned up ${savedFilenames.length} new image(s) due to error`);
      }
      
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update product'
      });
    }
  },

  // Delete product with image files
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

      // Get image paths and delete them from server
      const images = existingProduct.images as any[];
      let deletedImages = 0;
      let failedImages = 0;

      if (images && images.length > 0) {
        const imagePaths = getImagePathsFromProduct(images);
        const result = deleteFiles(imagePaths);
        deletedImages = result.success;
        failedImages = result.failed;
        
        if (deletedImages > 0) {
          console.log(`✅ Deleted ${deletedImages} image(s) from server`);
        }
        if (failedImages > 0) {
          console.log(`⚠️ Failed to delete ${failedImages} image(s)`);
        }
      }

      // Delete product from database
      await prisma.product.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Product deleted successfully',
        meta: {
          deletedImages,
          failedImages
        }
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