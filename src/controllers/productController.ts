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
      const barcodes = await prisma.barcode.findMany({
        select: {
          id: true,
          barcode: true,
          title: true
        },
        orderBy: {
          barcode: 'asc'
        }
      });

      res.json({
        success: true,
        data: barcodes
      });
    } catch (error: any) {
      console.error('Get barcodes error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch barcodes'
      });
    }
  },

  // Create product with barcode
  async create(req: Request, res: Response) {
    let savedFilenames: string[] = [];
    
    try {
      const {
        barcode,
        barcodeTitle,
        name,
        categoryId,
        buyingPrice,
        sellingPrice,
        videoUrl,
        description,
        images: imageUrls,
        forceOrderPriority,
        discountPercent,
      } = req.body;

      const files = req.files as Express.Multer.File[];

      // ==================== VALIDATION ====================
      
      // Validate barcode
      if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Barcode is required'
        });
      }

      // Validate barcode title
      if (!barcodeTitle || typeof barcodeTitle !== 'string' || barcodeTitle.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Barcode title is required'
        });
      }

      // Validate name
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

      // Validate category
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

      // Check if barcode already exists in product table
      const existingProduct = await prisma.product.findUnique({
        where: { barcode: barcode.trim() }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists'
        });
      }

      // Check if barcode already exists in barcode table
      const existingBarcode = await prisma.barcode.findUnique({
        where: { barcode: barcode.trim() }
      });

      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: 'Barcode already exists'
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

      // Validate prices
      const buyingPriceNum = parseFloat(buyingPrice);
      const sellingPriceNum = parseFloat(sellingPrice);
      
      if (isNaN(buyingPriceNum) || isNaN(sellingPriceNum)) {
        return res.status(400).json({
          success: false,
          message: 'Valid buying price and selling price are required'
        });
      }

      // Calculate discount and force order flags
      const discountPercentNum = discountPercent ? parseFloat(discountPercent) : null;
      const hasDiscountBool = discountPercentNum !== null && discountPercentNum > 0;
      
      const forceOrderPriorityNum = forceOrderPriority ? parseInt(forceOrderPriority) : 0;
      const isForceOrderBool = forceOrderPriorityNum > 0;

      // Validate images
      if ((!files || files.length === 0) && (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'At least one product image is required'
        });
      }

      // ==================== SAVE IMAGES ====================
      let finalImages: any[] = [];

      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        finalImages = savedFilenames.map(filename => ({
          imgUrl: `${req.protocol}://${req.get('host')}/uploads/product-images/${filename}`
        }));
      } else if (imageUrls && Array.isArray(imageUrls)) {
        finalImages = imageUrls;
      }

      // ==================== CREATE PRODUCT & BARCODE IN TRANSACTION ====================
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create product
        const product = await tx.product.create({
          data: {
            barcode: barcode.trim(),
            name: name.trim(),
            slug,
            videoUrl: videoUrl || null,
            description: description || null,
            images: finalImages,
            isForceOrder: isForceOrderBool,
            forceOrderPriority: forceOrderPriorityNum,
            categoryId: categoryIdNum,
            buyingPrice: buyingPriceNum,
            sellingPrice: sellingPriceNum,
            hasDiscount: hasDiscountBool,
            discountPercent: discountPercentNum,
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

        // 2. Create barcode record
        const barcodeRecord = await tx.barcode.create({
          data: {
            title: barcodeTitle.trim(),
            barcode: product.barcode
          }
        });

        return { product, barcodeRecord };
      });

      res.status(201).json({
        success: true,
        data: {
          product: result.product,
          barcode: result.barcodeRecord
        },
        message: 'Product and barcode created successfully'
      });
    } catch (error: any) {
      // Cleanup images on error
      if (savedFilenames.length > 0) {
        const imagePaths = savedFilenames.map(filename => 
          path.join(process.cwd(), 'public/uploads/product-images', filename)
        );
        deleteFiles(imagePaths);
      }
      
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create product'
      });
    }
  },

  // Update product with barcode
  async update(req: Request, res: Response) {
    let savedFilenames: string[] = [];
    
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
      const imageUrls = req.body.images;

      // Store old image paths for cleanup if replaced
      const oldImages = existingProduct.images as any[];
      let oldImagePaths: string[] = [];
      if (oldImages && oldImages.length > 0) {
        oldImagePaths = getImagePathsFromProduct(oldImages);
      }

      // Extract barcode fields
      const updateBarcode = updateData.barcode;
      const updateBarcodeTitle = updateData.barcodeTitle;
      
      // Remove from product update data
      delete updateData.barcodeTitle;

      // ==================== PARSE NUMERIC FIELDS ====================
      if (updateData.categoryId !== undefined) {
        updateData.categoryId = parseInt(updateData.categoryId);
      }
      if (updateData.buyingPrice !== undefined) {
        updateData.buyingPrice = parseFloat(updateData.buyingPrice);
      }
      if (updateData.sellingPrice !== undefined) {
        updateData.sellingPrice = parseFloat(updateData.sellingPrice);
      }
      if (updateData.forceOrderPriority !== undefined) {
        updateData.forceOrderPriority = parseInt(updateData.forceOrderPriority);
      }
      if (updateData.discountPercent !== undefined) {
        updateData.discountPercent = parseFloat(updateData.discountPercent);
      }

      // Calculate discount and force order flags from the values
      if (updateData.discountPercent !== undefined) {
        updateData.hasDiscount = updateData.discountPercent > 0;
      }
      if (updateData.forceOrderPriority !== undefined) {
        updateData.isForceOrder = updateData.forceOrderPriority > 0;
      }

      // ==================== VALIDATION ====================
      
      // If name is updated, regenerate slug
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
      if (updateBarcode) {
        const existingBarcode = await prisma.product.findFirst({
          where: {
            barcode: updateBarcode.trim(),
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

      // ==================== HANDLE IMAGES ====================
      let finalImages: any[] = [];

      if (files && files.length > 0) {
        // Save new images
        savedFilenames = saveImagesToDisk(files);
        finalImages = savedFilenames.map(filename => ({
          imgUrl: `${req.protocol}://${req.get('host')}/uploads/product-images/${filename}`
        }));
        updateData.images = finalImages;
      } else if (imageUrls && Array.isArray(imageUrls)) {
        updateData.images = imageUrls;
      }

      // ==================== UPDATE PRODUCT & BARCODE IN TRANSACTION ====================
      const result = await prisma.$transaction(async (tx) => {
        // Update product
        const product = await tx.product.update({
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

        // Update barcode if changed
        if (updateBarcode || updateBarcodeTitle) {
          const existingBarcodeRecord = await tx.barcode.findUnique({
            where: { barcode: existingProduct.barcode }
          });

          if (existingBarcodeRecord) {
            await tx.barcode.update({
              where: { id: existingBarcodeRecord.id },
              data: {
                title: updateBarcodeTitle || existingBarcodeRecord.title,
                barcode: updateBarcode || existingBarcodeRecord.barcode
              }
            });
          }
        }

        return product;
      });

      // Delete old images if replaced
      if (savedFilenames.length > 0 && oldImagePaths.length > 0) {
        deleteFiles(oldImagePaths);
      }

      res.json({
        success: true,
        data: result,
        message: 'Product updated successfully'
      });
    } catch (error: any) {
      // Cleanup new images on error
      if (savedFilenames.length > 0) {
        const newImagePaths = savedFilenames.map(filename => 
          path.join(process.cwd(), 'public/uploads/product-images', filename)
        );
        deleteFiles(newImagePaths);
      }
      
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update product'
      });
    }
  },

  // Delete product with barcode
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID'
        });
      }

      const product = await prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
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

      // Get image paths for cleanup
      const images = product.images as any[];
      let imagePaths: string[] = [];
      if (images && images.length > 0) {
        imagePaths = getImagePathsFromProduct(images);
      }

      // Delete product and barcode in transaction
      await prisma.$transaction(async (tx) => {
        // Delete product
        await tx.product.delete({
          where: { id }
        });

        // Delete associated barcode
        await tx.barcode.deleteMany({
          where: { barcode: product.barcode }
        });
      });

      // Delete images from disk
      if (imagePaths.length > 0) {
        deleteFiles(imagePaths);
      }

      res.json({
        success: true,
        message: 'Product and barcode deleted successfully'
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