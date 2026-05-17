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
      if (category) where.category = { slug: category };
      if (forceOrder) where.isForceOrder = true;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: { select: { id: true, name: true, slug: true } },
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
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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
      if (categoryId) where.categoryId = categoryId;
      if (forceOrder) where.isForceOrder = true;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: { select: { id: true, name: true, slug: true } },
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
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });

      const product = await prisma.product.findUnique({
        where: { id },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      res.json({ success: true, data: product });
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
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      res.json({ success: true, data: product });
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
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      res.json({ success: true, data: product });
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
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      res.json({ success: true, data: products });
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
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: categories });
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
        select: { id: true, barcode: true, title: true },
        orderBy: { barcode: "asc" },
      });
      res.json({ success: true, data: barcodes });
    } catch (error: any) {
      console.error("Get barcodes error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch barcodes",
      });
    }
  },

  // ==================== CREATE ====================
  async create(req: Request, res: Response) {
    let savedFilenames: string[] = [];

    try {
      const {
        barcode,
        barcodeTitle,
        name,
        categoryId,
        buyingOrMakingPrice,
        sellingPrice,
        discountPercent,
        initialStock,
        videoUrl,
        description,
        images: imageUrls,
        forceOrderPriority,
      } = req.body;

      const files = req.files as Express.Multer.File[];

      // Validate barcode if provided
      if (
        barcode !== undefined &&
        (typeof barcode !== "string" || barcode.trim() === "")
      ) {
        return res.status(400).json({
          success: false,
          message: "If provided, barcode must be a non-empty string",
        });
      }

      // If barcode is provided but barcodeTitle is missing, use product name as title
      let finalBarcodeTitle = barcodeTitle;
      if (barcode && (!finalBarcodeTitle || finalBarcodeTitle.trim() === "")) {
        finalBarcodeTitle = name ? name.trim() : "Product";
      }

      // Product name validation
      if (!name || typeof name !== "string" || name.trim() === "")
        return res
          .status(400)
          .json({ success: false, message: "Product name required" });
      if (name.length < 2)
        return res
          .status(400)
          .json({
            success: false,
            message: "Product name at least 2 characters",
          });
      if (name.length > 100)
        return res
          .status(400)
          .json({ success: false, message: "Product name max 100 characters" });

      const categoryIdNum = parseInt(categoryId);
      if (isNaN(categoryIdNum))
        return res
          .status(400)
          .json({ success: false, message: "Valid category ID required" });
      const category = await prisma.category.findUnique({
        where: { id: categoryIdNum },
      });
      if (!category)
        return res
          .status(400)
          .json({ success: false, message: "Category not found" });

      if (barcode) {
        const existingProduct = await prisma.product.findUnique({
          where: { barcode: barcode.trim() },
        });
        if (existingProduct)
          return res
            .status(400)
            .json({
              success: false,
              message: "Product with this barcode already exists",
            });
        const existingBarcode = await prisma.barcode.findUnique({
          where: { barcode: barcode.trim() },
        });
        if (existingBarcode)
          return res
            .status(400)
            .json({ success: false, message: "Barcode already exists" });
      }

      const slug = generateSlug(name);
      const existingSlug = await prisma.product.findUnique({ where: { slug } });
      if (existingSlug)
        return res
          .status(400)
          .json({
            success: false,
            message: "Product with this name already exists",
          });

      // Save images
      let finalImages: any[] = [];
      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        finalImages = savedFilenames.map((filename) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${filename}`,
        }));
      } else if (imageUrls && Array.isArray(imageUrls)) {
        finalImages = imageUrls;
      } else {
        return res
          .status(400)
          .json({
            success: false,
            message: "At least one product image required",
          });
      }

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            barcode: barcode ? barcode.trim() : null,
            name: name.trim(),
            slug,
            videoUrl: videoUrl || null,
            description: description || null,
            images: finalImages,
            isForceOrder:
              (forceOrderPriority && parseInt(forceOrderPriority) > 0) || false,
            forceOrderPriority: parseInt(forceOrderPriority) || 0,
            category: { connect: { id: categoryIdNum } },
          },
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        });

        // Create barcode record only if barcode and title exist (title now optional)
        if (barcode && finalBarcodeTitle) {
          await tx.barcode.create({
            data: {
              title: finalBarcodeTitle.trim(),
              barcode: product.barcode!,
            },
          });
        }

        // If initial stock data is provided, create a default variant and stock batch
        if (buyingOrMakingPrice && sellingPrice && initialStock) {
          const defaultSku = product.barcode
            ? product.barcode
            : `PROD-${product.id}`;
          const variant = await tx.variant.create({
            data: { sku: defaultSku, productId: product.id, attributes: {} },
          });
          await tx.stock.create({
            data: {
              variantId: variant.id,
              batchNo: "1",
              buyingOrMakingPrice: parseFloat(buyingOrMakingPrice),
              sellingPrice: parseFloat(sellingPrice),
              discountPercent: parseInt(discountPercent) || 0,
              currentQty: parseInt(initialStock),
            },
          });
        }

        return { product };
      });

      res.status(201).json({
        success: true,
        data: { product: result.product },
        message: "Product created successfully (draft)",
      });
    } catch (error: any) {
      if (savedFilenames.length) {
        const imagePaths = savedFilenames.map((filename) =>
          path.join(process.cwd(), "public/uploads/product-images", filename),
        );
        deleteFiles(imagePaths);
      }
      console.error("Create product error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to create product",
        });
    }
  },

  // ==================== UPDATE ====================
  async update(req: Request, res: Response) {
    let savedFilenames: string[] = [];

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });

      const existingProduct = await prisma.product.findUnique({
        where: { id },
      });
      if (!existingProduct)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      const files = req.files as Express.Multer.File[];
      const updateData: any = {};

      const allowedFields = [
        "barcode",
        "name",
        "slug",
        "videoUrl",
        "description",
        "isForceOrder",
        "forceOrderPriority",
        "categoryId",
        "images",
      ];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      }

      let existingImages = req.body.existingImages;
      if (typeof existingImages === "string") {
        try {
          existingImages = JSON.parse(existingImages);
        } catch {
          existingImages = [];
        }
      }
      const updateBarcodeTitle = req.body.barcodeTitle;
      const updateBarcode = updateData.barcode;
      delete updateData.barcodeTitle;

      if (updateData.forceOrderPriority !== undefined)
        updateData.forceOrderPriority = parseInt(updateData.forceOrderPriority);
      if (updateData.categoryId !== undefined)
        updateData.categoryId = parseInt(updateData.categoryId);
      if (updateData.name) {
        if (updateData.name.length < 2 || updateData.name.length > 100)
          return res.status(400).json({
            success: false,
            message: "Product name length must be 2-100 characters",
          });
        updateData.slug = generateSlug(updateData.name);
        const existingSlug = await prisma.product.findFirst({
          where: { slug: updateData.slug, id: { not: id } },
        });
        if (existingSlug)
          return res.status(400).json({
            success: false,
            message: "Product with this name already exists",
          });
      }
      if (updateBarcode) {
        const existingBarcode = await prisma.product.findFirst({
          where: { barcode: updateBarcode.trim(), id: { not: id } },
        });
        if (existingBarcode)
          return res.status(400).json({
            success: false,
            message: "Product with this barcode already exists",
          });
      }

      let finalImages: any[] = existingImages ? [...existingImages] : [];
      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        const newUrls = savedFilenames.map((f) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${f}`,
        }));
        finalImages = [...finalImages, ...newUrls];
      }
      if (finalImages.length) updateData.images = finalImages;
      if (updateData.images === undefined && existingProduct.images) {
        updateData.images = existingProduct.images;
      }

      const {
        buyingOrMakingPrice: newBatchCost,
        sellingPrice: newBatchSellingPrice,
        discountPercent: newBatchDiscount,
        newStockQty,
        variantId, // optionally specify which variant to add batch to
      } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.update({
          where: { id },
          data: updateData,
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        });

        // Update barcode if changed
        if (existingProduct.barcode && (updateBarcode || updateBarcodeTitle)) {
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

        // Add new batch if pricing and quantity provided
        if (
          newBatchCost !== undefined &&
          newBatchSellingPrice !== undefined &&
          newStockQty !== undefined &&
          parseInt(newStockQty) > 0
        ) {
          let targetVariantId = variantId;
          if (!targetVariantId) {
            // Find or create default variant
            const defaultVariant = await tx.variant.findFirst({
              where: { productId: product.id, attributes: {} },
            });
            if (defaultVariant) {
              targetVariantId = defaultVariant.id;
            } else {
              const defaultSku = product.barcode
                ? product.barcode
                : `PROD-${product.id}`;
              const newVariant = await tx.variant.create({
                data: {
                  sku: defaultSku,
                  productId: product.id,
                  attributes: {},
                },
              });
              targetVariantId = newVariant.id;
            }
          }
          // Get next batch number for this variant
          const lastBatch = await tx.stock.findFirst({
            where: { variantId: targetVariantId },
            orderBy: { batchNo: "desc" },
          });
          let nextBatchNo = "1";
          if (lastBatch) {
            const num = parseInt(lastBatch.batchNo);
            nextBatchNo = isNaN(num)
              ? lastBatch.batchNo + "-1"
              : (num + 1).toString();
          }
          await tx.stock.create({
            data: {
              variantId: targetVariantId,
              batchNo: nextBatchNo,
              buyingOrMakingPrice: parseFloat(newBatchCost),
              sellingPrice: parseFloat(newBatchSellingPrice),
              discountPercent: parseInt(newBatchDiscount) || 0,
              currentQty: parseInt(newStockQty),
            },
          });
        }

        return product;
      });

      res.json({
        success: true,
        data: result,
        message: "Product updated successfully",
      });
    } catch (error: any) {
      if (savedFilenames.length) {
        const paths = savedFilenames.map((f) =>
          path.join(process.cwd(), "public/uploads/product-images", f),
        );
        deleteFiles(paths);
      }
      console.error("Update product error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  // DELETE product with all variants and stocks
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });

      const product = await prisma.product.findUnique({
        where: { id },
        include: { variants: true },
      });
      if (!product)
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });

      const soldItems = await prisma.soldItem.findMany({
        where: { productId: id },
        take: 1,
      });
      if (soldItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete product with existing sales records",
        });
      }

      const images = product.images as any[];
      let imagePaths: string[] = [];
      if (images && images.length > 0)
        imagePaths = getImagePathsFromProduct(images);

      await prisma.$transaction(async (tx) => {
        // Delete all stocks of all variants
        const variantIds = product.variants.map((v) => v.id);
        if (variantIds.length) {
          await tx.stock.deleteMany({
            where: { variantId: { in: variantIds } },
          });
          await tx.variant.deleteMany({
            where: { productId: id },
          });
        }
        // Delete barcode if exists
        if (product.barcode) {
          await tx.barcode.deleteMany({ where: { barcode: product.barcode } });
        }
        // Finally delete product
        await tx.product.delete({ where: { id } });
      });

      if (imagePaths.length > 0) deleteFiles(imagePaths);

      res.json({
        success: true,
        message:
          "Product, variants, and associated stocks deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete product error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete product",
      });
    }
  },

  // Advanced filter (stock summary) – updated to work with variant-stock structure
  async advancedFilter(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const minDiscount = req.query.minDiscount
        ? parseFloat(req.query.minDiscount as string)
        : undefined;
      const maxDiscount = req.query.maxDiscount
        ? parseFloat(req.query.maxDiscount as string)
        : undefined;
      const minBuying = req.query.minBuying
        ? parseFloat(req.query.minBuying as string)
        : undefined;
      const maxBuying = req.query.maxBuying
        ? parseFloat(req.query.maxBuying as string)
        : undefined;
      const minSelling = req.query.minSelling
        ? parseFloat(req.query.minSelling as string)
        : undefined;
      const maxSelling = req.query.maxSelling
        ? parseFloat(req.query.maxSelling as string)
        : undefined;
      const sortStock = req.query.sortStock as string;
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: any[] = [];

      if (search) {
        conditions.push(`(p.name LIKE ? OR p.barcode LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`);
      }
      if (categoryId) {
        conditions.push(`p.category_id = ?`);
        params.push(categoryId);
      }

      // Subquery for latest stock info (now joins via variants)
      const latestStockSubquery = `
        SELECT s.buying_or_making_price, s.selling_price, s.discount_percent
        FROM stocks s
        JOIN variants v ON v.id = s.variant_id
        WHERE v.product_id = p.id
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      if (minDiscount !== undefined || maxDiscount !== undefined) {
        const discountParts: string[] = [];
        if (minDiscount !== undefined)
          discountParts.push(`ls.discount_percent >= ${minDiscount}`);
        if (maxDiscount !== undefined)
          discountParts.push(`ls.discount_percent <= ${maxDiscount}`);
        conditions.push(
          `EXISTS (SELECT 1 FROM (${latestStockSubquery}) ls WHERE ${discountParts.join(" AND ")})`,
        );
      }

      if (minBuying !== undefined || maxBuying !== undefined) {
        const buyingParts: string[] = [];
        if (minBuying !== undefined)
          buyingParts.push(`ls.buying_or_making_price >= ${minBuying}`);
        if (maxBuying !== undefined)
          buyingParts.push(`ls.buying_or_making_price <= ${maxBuying}`);
        conditions.push(
          `EXISTS (SELECT 1 FROM (${latestStockSubquery}) ls WHERE ${buyingParts.join(" AND ")})`,
        );
      }

      if (minSelling !== undefined || maxSelling !== undefined) {
        const sellingParts: string[] = [];
        if (minSelling !== undefined)
          sellingParts.push(`ls.selling_price >= ${minSelling}`);
        if (maxSelling !== undefined)
          sellingParts.push(`ls.selling_price <= ${maxSelling}`);
        conditions.push(
          `EXISTS (SELECT 1 FROM (${latestStockSubquery}) ls WHERE ${sellingParts.join(" AND ")})`,
        );
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      let orderClause = "ORDER BY total_stock ASC";
      if (sortStock === "high") orderClause = "ORDER BY total_stock DESC";

      const query = `
        SELECT 
          p.id,
          p.barcode,
          p.name,
          p.images,
          p.category_id,
          c.name as category_name,
          COALESCE(SUM(s.current_qty), 0) as total_stock,
          (
            SELECT s2.buying_or_making_price 
            FROM stocks s2
            JOIN variants v2 ON v2.id = s2.variant_id
            WHERE v2.product_id = p.id
            ORDER BY s2.created_at DESC 
            LIMIT 1
          ) as latest_buying_price,
          (
            SELECT s2.selling_price 
            FROM stocks s2
            JOIN variants v2 ON v2.id = s2.variant_id
            WHERE v2.product_id = p.id
            ORDER BY s2.created_at DESC 
            LIMIT 1
          ) as latest_selling_price,
          (
            SELECT s2.discount_percent 
            FROM stocks s2
            JOIN variants v2 ON v2.id = s2.variant_id
            WHERE v2.product_id = p.id
            ORDER BY s2.created_at DESC 
            LIMIT 1
          ) as latest_discount_percent
        FROM products p
        LEFT JOIN variants v ON v.product_id = p.id
        LEFT JOIN stocks s ON s.variant_id = v.id
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        GROUP BY p.id, p.barcode, p.name, p.images, p.category_id, c.name
        ${orderClause}
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);

      const products = (await prisma.$queryRawUnsafe(
        query,
        ...params,
      )) as any[];

      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM products p
        LEFT JOIN variants v ON v.product_id = p.id
        LEFT JOIN stocks s ON s.variant_id = v.id
        ${whereClause}
      `;
      const countParams = params.slice(0, -2);
      const totalResult = (await prisma.$queryRawUnsafe(
        countQuery,
        ...countParams,
      )) as any[];
      const total = Number(totalResult[0]?.total || 0);

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
      console.error("Advanced filter error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
