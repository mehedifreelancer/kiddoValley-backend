import { Request, Response } from "express";
import path from "path";
import { generateSlug } from "../utils/slugify";
import { prisma } from "../lib/prisma";
import { deleteFiles, getImagePathsFromProduct } from "../utils/fileUtils";
import { saveImagesToDisk } from "../multer";

export const productController = {
  // Get all products (public with pagination and search)
  async getAllPublic(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | string[];
      const category = req.query.category as string;
      const forceOrder = req.query.forceOrder === "true";

      const skip = (page - 1) * limit;

      let where: any = {};

      if (search) {
        const searchTerms = Array.isArray(search) ? search : [search];
        where.AND = searchTerms.map((term) => ({
          OR: [{ name: { contains: term } }, { barcode: { contains: term } }],
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
                slug: true,
              },
            },
          },
          orderBy: forceOrder
            ? { forceOrderPriority: "desc" }
            : { createdAt: "desc" },
        }),
        prisma.product.count({ where }),
      ]);

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
      console.error("Get all products error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch products",
      });
    }
  },

  // Get all products (admin - full access with search)
  async getAllAdmin(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | string[];
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const forceOrder = req.query.forceOrder === "true";

      const skip = (page - 1) * limit;

      let where: any = {};

      if (search) {
        const searchTerms = Array.isArray(search) ? search : [search];
        where.AND = searchTerms.map((term) => ({
          OR: [
            { name: { contains: term } },
            { barcode: { contains: term } },
            { slug: { contains: term } },
          ],
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
                slug: true,
              },
            },
          },
          orderBy: forceOrder
            ? { forceOrderPriority: "desc" }
            : { createdAt: "desc" },
        }),
        prisma.product.count({ where }),
      ]);

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
      console.error("Get all products admin error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch products",
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
          message: "Invalid product ID",
        });
      }

      const product = await prisma.product.findUnique({
        where: { id },
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
      console.error("Get product by ID error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch product",
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
      console.error("Get product by slug error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch product",
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
      console.error("Get product by barcode error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch product",
      });
    }
  },

  // Get force order products
  async getForceOrder(req: Request, res: Response) {
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
      console.error("Get force order products error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch force order products",
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
          slug: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      res.json({
        success: true,
        data: categories,
      });
    } catch (error: any) {
      console.error("Get categories error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch categories",
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
          title: true,
        },
        orderBy: {
          barcode: "asc",
        },
      });

      res.json({
        success: true,
        data: barcodes,
      });
    } catch (error: any) {
      console.error("Get barcodes error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch barcodes",
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

      if (!barcode || typeof barcode !== "string" || barcode.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Barcode is required",
        });
      }

      if (
        !barcodeTitle ||
        typeof barcodeTitle !== "string" ||
        barcodeTitle.trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "Barcode title is required",
        });
      }

      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Product name is required",
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Product name must be at least 2 characters",
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Product name must be less than 100 characters",
        });
      }

      const categoryIdNum = parseInt(categoryId);
      if (isNaN(categoryIdNum)) {
        return res.status(400).json({
          success: false,
          message: "Valid category ID is required",
        });
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryIdNum },
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { barcode: barcode.trim() },
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product with this barcode already exists",
        });
      }

      const existingBarcode = await prisma.barcode.findUnique({
        where: { barcode: barcode.trim() },
      });

      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: "Barcode already exists",
        });
      }

      const slug = generateSlug(name);

      const existingSlug = await prisma.product.findUnique({
        where: { slug },
      });

      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: "Product with this name already exists",
        });
      }

      const buyingPriceNum = parseFloat(buyingPrice);
      const sellingPriceNum = parseFloat(sellingPrice);

      if (isNaN(buyingPriceNum) || isNaN(sellingPriceNum)) {
        return res.status(400).json({
          success: false,
          message: "Valid buying price and selling price are required",
        });
      }

      const discountPercentNum = discountPercent
        ? parseFloat(discountPercent)
        : null;
      const hasDiscountBool =
        discountPercentNum !== null && discountPercentNum > 0;

      const forceOrderPriorityNum = forceOrderPriority
        ? parseInt(forceOrderPriority)
        : 0;
      const isForceOrderBool = forceOrderPriorityNum > 0;

      // ==================== SAVE IMAGES ====================
      let finalImages: any[] = [];

      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        finalImages = savedFilenames.map((filename) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${filename}`,
        }));
      } else if (imageUrls && Array.isArray(imageUrls)) {
        finalImages = imageUrls;
      } else {
        return res.status(400).json({
          success: false,
          message: "At least one product image is required",
        });
      }

      // ==================== CREATE PRODUCT & BARCODE IN TRANSACTION ====================
      const result = await prisma.$transaction(async (tx) => {
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
                slug: true,
              },
            },
          },
        });

        const barcodeRecord = await tx.barcode.create({
          data: {
            title: barcodeTitle.trim(),
            barcode: product.barcode,
          },
        });

        return { product, barcodeRecord };
      });

      res.status(201).json({
        success: true,
        data: {
          product: result.product,
          barcode: result.barcodeRecord,
        },
        message: "Product and barcode created successfully",
      });
    } catch (error: any) {
      if (savedFilenames.length > 0) {
        const imagePaths = savedFilenames.map((filename) =>
          path.join(process.cwd(), "public/uploads/product-images", filename),
        );
        deleteFiles(imagePaths);
      }

      console.error("Create product error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create product",
      });
    }
  },

  // Update product with barcode - FIXED: Adds new images, preserves order
  // Update product with barcode (supports existing images + new file uploads)
  // Update product with barcode (fixed version)
  async update(req: Request, res: Response) {
    let savedFilenames: string[] = [];

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id },
      });
      if (!existingProduct) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const files = req.files as Express.Multer.File[];
      const updateData: any = {};

      // List of allowed fields that can be updated directly
      const allowedFields = [
        "barcode",
        "name",
        "slug",
        "videoUrl",
        "description",
        "isForceOrder",
        "forceOrderPriority",
        "categoryId",
        "buyingPrice",
        "sellingPrice",
        "hasDiscount",
        "discountPercent",
        "images",
      ];

      // Copy only allowed fields from req.body
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      // Handle existingImages (sent as JSON string)
      let existingImages = req.body.existingImages;
      if (typeof existingImages === "string") {
        try {
          existingImages = JSON.parse(existingImages);
        } catch (e) {
          existingImages = [];
        }
      }

      // Handle barcode title separately (it goes to barcode table, not product)
      const updateBarcodeTitle = req.body.barcodeTitle;
      const updateBarcode = updateData.barcode;
      delete updateData.barcodeTitle; // not a product field

      // Parse numeric fields
      if (updateData.categoryId !== undefined)
        updateData.categoryId = parseInt(updateData.categoryId);
      if (updateData.buyingPrice !== undefined)
        updateData.buyingPrice = parseFloat(updateData.buyingPrice);
      if (updateData.sellingPrice !== undefined)
        updateData.sellingPrice = parseFloat(updateData.sellingPrice);
      if (updateData.forceOrderPriority !== undefined)
        updateData.forceOrderPriority = parseInt(updateData.forceOrderPriority);
      if (updateData.discountPercent !== undefined)
        updateData.discountPercent = parseFloat(updateData.discountPercent);

      // Auto‑set boolean flags
      if (updateData.discountPercent !== undefined)
        updateData.hasDiscount = updateData.discountPercent > 0;
      if (updateData.forceOrderPriority !== undefined)
        updateData.isForceOrder = updateData.forceOrderPriority > 0;

      // Build final images array: existing (ordered) + new uploaded files
      let finalImages: any[] = existingImages ? [...existingImages] : [];

      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        const newImageUrls = savedFilenames.map((filename) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${filename}`,
        }));
        finalImages = [...finalImages, ...newImageUrls];
      }

      if (finalImages.length > 0) {
        updateData.images = finalImages;
      }

      // Validate name and barcode uniqueness
      if (updateData.name) {
        if (updateData.name.length < 2) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Product name must be at least 2 characters",
            });
        }
        if (updateData.name.length > 100) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Product name must be less than 100 characters",
            });
        }
        updateData.slug = generateSlug(updateData.name);
        const existingSlug = await prisma.product.findFirst({
          where: { slug: updateData.slug, id: { not: id } },
        });
        if (existingSlug) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Product with this name already exists",
            });
        }
      }

      if (updateBarcode) {
        const existingBarcode = await prisma.product.findFirst({
          where: { barcode: updateBarcode.trim(), id: { not: id } },
        });
        if (existingBarcode) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Product with this barcode already exists",
            });
        }
      }

      // 🔁 Transaction: update product and associated barcode
      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.update({
          where: { id },
          data: updateData,
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        });

        if (updateBarcode || updateBarcodeTitle) {
          const barcodeRecord = await tx.barcode.findUnique({
            where: { barcode: existingProduct.barcode },
          });
          if (barcodeRecord) {
            await tx.barcode.update({
              where: { id: barcodeRecord.id },
              data: {
                title: updateBarcodeTitle || barcodeRecord.title,
                barcode: updateBarcode || barcodeRecord.barcode,
              },
            });
          }
        }
        return product;
      });

      res.json({
        success: true,
        data: result,
        message: "Product updated successfully",
      });
    } catch (error: any) {
      // Cleanup newly uploaded files on error
      if (savedFilenames.length) {
        const paths = savedFilenames.map((f) =>
          path.join(process.cwd(), "public/uploads/product-images", f),
        );
        deleteFiles(paths);
      }
      console.error("Update product error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Internal server error",
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
          message: "Invalid product ID",
        });
      }

      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const saleItems = await prisma.saleItem.findMany({
        where: { productId: id },
        take: 1,
      });

      if (saleItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete product with existing sales records",
        });
      }

      const images = product.images as any[];
      let imagePaths: string[] = [];
      if (images && images.length > 0) {
        imagePaths = getImagePathsFromProduct(images);
      }

      await prisma.$transaction(async (tx) => {
        await tx.product.delete({
          where: { id },
        });

        await tx.barcode.deleteMany({
          where: { barcode: product.barcode },
        });
      });

      if (imagePaths.length > 0) {
        deleteFiles(imagePaths);
      }

      res.json({
        success: true,
        message: "Product and barcode deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete product error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete product",
      });
    }
  },
};
