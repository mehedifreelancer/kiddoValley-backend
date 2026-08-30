import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { generateSlug } from "../utils/slugify";
import { prisma } from "../lib/prisma";
import { deleteFiles } from "../utils/fileUtils";
import { saveImagesToDisk } from "../multer";

// Helper: ensure every variant has at least one stock (price set)
async function validateAllVariantsHaveStock(productId: number): Promise<void> {
  const variants = await prisma.variant.findMany({
    where: { productId },
    include: { stocks: { take: 1 } },
  });
  const missingVariants = variants.filter((v) => v.stocks.length === 0);
  if (missingVariants.length > 0) {
    const skus = missingVariants.map((v) => v.sku).join(", ");
    throw new Error(
      `Please add at least one price set for all variants before saving. Missing: ${skus}`,
    );
  }
}

// ---------- Transform for public API ----------
function transformProductForPublic(product: any) {
  const thumbnailImage = product.thumbnail || null;

  const variants = (product.variants || []).map((variant: any) => {
    const firstStock = variant.stocks?.[0] || {};
    const totalStock =
      variant.stocks?.reduce(
        (sum: number, s: any) => sum + (s.currentQty || 0),
        0,
      ) || 0;

    let inStock = "out of stock";
    if (totalStock > 5) inStock = "in stock";
    else if (totalStock > 0) inStock = "less than 5";

    const firstImage = variant.images?.[0]?.imgUrl || null;

    return {
      id: variant.id,
      sku: variant.sku,
      stockId: firstStock.id || null,
      price: firstStock.sellingPrice || 0,
      discount: firstStock.discountPercent || 0,
      inStock: inStock,
      imgUrl: firstImage,
      attributes: variant.attributes || {},
    };
  });

  // Aggregated attributes
  const aggregatedAttributes: Record<string, Set<string>> = {};
  if (product.variants) {
    product.variants.forEach((variant: any) => {
      if (variant.attributes && typeof variant.attributes === "object") {
        for (const [key, value] of Object.entries(variant.attributes)) {
          if (!aggregatedAttributes[key]) {
            aggregatedAttributes[key] = new Set();
          }
          if (typeof value === "string") {
            aggregatedAttributes[key].add(value);
          } else if (Array.isArray(value)) {
            value.forEach((v: any) => aggregatedAttributes[key].add(String(v)));
          }
        }
      }
    });
  }

  // Priority: product-level first, then category
  const productPriority = (product.attributePriority as string[]) || [];
  const categoryPriority =
    (product.category?.attributePriority as string[]) || [];
  const priority =
    productPriority.length > 0 ? productPriority : categoryPriority;

  const attributeOrderByPriority = priority.map((key: string) => ({
    key: key,
    values: aggregatedAttributes[key]
      ? Array.from(aggregatedAttributes[key])
      : [],
  }));

  const category = product.category
    ? {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      }
    : null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    description: product.description,
    videoUrl: product.videoUrl,
    thumbnailImage: thumbnailImage,
    weight: product.weight,
    variants: variants,
    attributeOrderByPriority: attributeOrderByPriority,
    isForceOrder: product.isForceOrder,
    forceOrderPriority: product.forceOrderPriority,
    isPublished: product.isPublished,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    category: category,
  };
}

export const productController = {
  // ==================== PUBLIC ENDPOINTS ====================
  async getAllPublic(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const search = req.query.search as string | string[];
      const category = req.query.category as string;

      const skip = (page - 1) * limit;
      let where: any = { isPublished: true };

      if (search) {
        const searchTerms = Array.isArray(search) ? search : [search];
        where.AND = searchTerms.map((term) => ({
          OR: [{ name: { contains: term } }, { slug: { contains: term } }],
        }));
      }
      if (category) where.category = { slug: category };

      // Get sorted IDs: forced items (priority > 0) first in 1,2,3... order,
      // then everything else by newest first.
      const allMatching = await prisma.product.findMany({
        where,
        select: { id: true },
      });
      // fallback if catalog is small — safe for now, see note below
      void allMatching;

      const products = await prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              attributePriority: true,
            },
          },
          variants: {
            include: {
              stocks: {
                select: {
                  id: true,
                  currentQty: true,
                  sellingPrice: true,
                  discountPercent: true,
                },
              },
            },
          },
        },
        orderBy: [
          { forceOrderPriority: "desc" }, // higher priority first, 0s sink to bottom
          { createdAt: "desc" },
        ],
      });

      const total = products.length;
      const paged = products.slice(skip, skip + limit);

      const transformedData = paged.map((product) =>
        transformProductForPublic(product),
      );

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      res.json({
        success: true,
        data: transformedData,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          next: hasNext ? page + 1 : null,
          prev: hasPrev ? page - 1 : null,
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
              attributePriority: true,
            },
          },
          variants: {
            include: {
              stocks: {
                select: {
                  id: true,
                  currentQty: true,
                  sellingPrice: true,
                  discountPercent: true,
                },
              },
            },
          },
        },
      });
      if (!product || !product.isPublished) {
        // ✅ unpublished হলে 404
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }
      const transformed = transformProductForPublic(product);
      res.json({ success: true, data: transformed });
    } catch (error: any) {
      console.error("Get product by slug error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch product",
      });
    }
  },

  async getForceOrder(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        where: { isForceOrder: true, isPublished: true },
        orderBy: { forceOrderPriority: "asc" }, // ✅ 1 আগে, 2 পরে...
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              attributePriority: true,
            },
          },
          variants: {
            include: {
              stocks: {
                select: {
                  id: true,
                  currentQty: true,
                  sellingPrice: true,
                  discountPercent: true,
                },
              },
            },
          },
        },
      });
      const transformedData = products.map((product) =>
        transformProductForPublic(product),
      );
      res.json({ success: true, data: transformedData });
    } catch (error: any) {
      console.error("Get force order products error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch force order products",
      });
    }
  },

  // ==================== ADMIN ENDPOINTS ====================
  async getAllAdmin(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | string[];
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;

      const skip = (page - 1) * limit;
      let where: any = {};

      if (search) {
        const searchTerms = Array.isArray(search) ? search : [search];
        where.AND = searchTerms.map((term) => ({
          OR: [{ name: { contains: term } }, { slug: { contains: term } }],
        }));
      }
      if (categoryId) where.categoryId = categoryId;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [
            { forceOrderPriority: "desc" }, // higher priority first, 0 (non-forced) sinks to bottom
            { createdAt: "desc" }, // newest first within same priority
          ],
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

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }
      const product = await prisma.product.findUnique({
        where: { id },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }
      res.json({ success: true, data: product });
    } catch (error: any) {
      console.error("Get product by ID error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch product",
      });
    }
  },

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

  // ==================== CREATE ====================
  async create(req: Request, res: Response) {
    let savedFilenames: string[] = [];

    try {
      const {
        name,
        categoryId,
        videoUrl,
        description,
        forceOrderPriority,
        attributePriority,
        weight,
      } = req.body;
      const file = req.file as Express.Multer.File;

      if (!name || typeof name !== "string" || name.trim() === "") {
        return res
          .status(400)
          .json({ success: false, message: "Product name required" });
      }
      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Product name at least 2 characters",
        });
      }
      if (name.length > 100) {
        return res
          .status(400)
          .json({ success: false, message: "Product name max 100 characters" });
      }

      const categoryIdNum = parseInt(categoryId);
      if (isNaN(categoryIdNum)) {
        return res
          .status(400)
          .json({ success: false, message: "Valid category ID required" });
      }
      const category = await prisma.category.findUnique({
        where: { id: categoryIdNum },
      });
      if (!category) {
        return res
          .status(400)
          .json({ success: false, message: "Category not found" });
      }

      const slug = generateSlug(name);
      const existingSlug = await prisma.product.findUnique({ where: { slug } });
      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: "Product with this name already exists",
        });
      }

      let thumbnail: string | null = null;
      if (file) {
        savedFilenames = saveImagesToDisk([file]);
        thumbnail = `${req.protocol}://${req.get("host")}/uploads/product-images/${savedFilenames[0]}`;
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Thumbnail image is required" });
      }

      let parsedPriority: string[] = [];
      if (attributePriority) {
        if (typeof attributePriority === "string") {
          try {
            parsedPriority = JSON.parse(attributePriority);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message:
                "Invalid attributePriority format. Must be a JSON array.",
            });
          }
        } else if (Array.isArray(attributePriority)) {
          parsedPriority = attributePriority;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: name.trim(),
            slug,
            videoUrl: videoUrl || null,
            description: description || null,
            thumbnail,
            weight: weight !== undefined ? parseFloat(weight) : null,
            isForceOrder:
              (forceOrderPriority && parseInt(forceOrderPriority) > 0) || false,
            forceOrderPriority: parseInt(forceOrderPriority) || 0,
            category: { connect: { id: categoryIdNum } },
            attributePriority: parsedPriority,
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                attributePriority: true,
              },
            },
          },
        });

        if (parsedPriority.length > 0) {
          const cat = product.category;
          if (
            !cat.attributePriority ||
            (Array.isArray(cat.attributePriority) &&
              cat.attributePriority.length === 0)
          ) {
            await tx.category.update({
              where: { id: cat.id },
              data: { attributePriority: parsedPriority },
            });
          }
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
      res.status(500).json({
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
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id },
        include: { category: true },
      });
      if (!existingProduct) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const file = req.file as Express.Multer.File;
      const updateData: any = {};

      const allowedFields = [
        "name",
        "slug",
        "videoUrl",
        "description",
        "isForceOrder",
        "forceOrderPriority",
        "categoryId",
        "attributePriority",
        "weight",
      ];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      }

      if (updateData.categoryId !== undefined) {
        updateData.categoryId = parseInt(updateData.categoryId);
      }

      if (updateData.name) {
        if (updateData.name.length < 2 || updateData.name.length > 100) {
          return res.status(400).json({
            success: false,
            message: "Product name length must be 2-100 characters",
          });
        }
        updateData.slug = generateSlug(updateData.name);
        const existingSlug = await prisma.product.findFirst({
          where: { slug: updateData.slug, id: { not: id } },
        });
        if (existingSlug) {
          return res.status(400).json({
            success: false,
            message: "Product with this name already exists",
          });
        }
      }

      if (updateData.forceOrderPriority !== undefined) {
        updateData.forceOrderPriority = parseInt(updateData.forceOrderPriority);
      }

      if (updateData.weight !== undefined) {
        updateData.weight = parseFloat(updateData.weight) || null;
      }

      let thumbnail: string | null = req.body.existingThumbnail || null;
      if (file) {
        savedFilenames = saveImagesToDisk([file]);
        thumbnail = `${req.protocol}://${req.get("host")}/uploads/product-images/${savedFilenames[0]}`;
      }
      updateData.thumbnail = thumbnail;

      if (updateData.isPublished === true) {
        await validateAllVariantsHaveStock(id);
      }

      let parsedPriority: string[] | undefined = undefined;
      if (updateData.attributePriority !== undefined) {
        if (typeof updateData.attributePriority === "string") {
          try {
            parsedPriority = JSON.parse(updateData.attributePriority);
            updateData.attributePriority = parsedPriority;
          } catch (e) {
            return res.status(400).json({
              success: false,
              message:
                "Invalid attributePriority format. Must be a JSON array.",
            });
          }
        } else if (Array.isArray(updateData.attributePriority)) {
          parsedPriority = updateData.attributePriority;
        }
      }

      const {
        buyingOrMakingPrice: newBatchCost,
        sellingPrice: newBatchSellingPrice,
        discountPercent: newBatchDiscount,
        newStockQty,
        variantId,
      } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.update({
          where: { id },
          data: updateData,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                attributePriority: true,
              },
            },
          },
        });

        if (parsedPriority && parsedPriority.length > 0) {
          const cat = product.category;
          if (
            !cat.attributePriority ||
            (Array.isArray(cat.attributePriority) &&
              cat.attributePriority.length === 0)
          ) {
            await tx.category.update({
              where: { id: cat.id },
              data: { attributePriority: parsedPriority },
            });
          }
        }

        if (
          newBatchCost !== undefined &&
          newBatchSellingPrice !== undefined &&
          newStockQty !== undefined &&
          parseInt(newStockQty) > 0
        ) {
          let targetVariantId = variantId;
          if (!targetVariantId) {
            const defaultVariant = await tx.variant.findFirst({
              where: { productId: product.id, attributes: {} },
            });
            if (defaultVariant) {
              targetVariantId = defaultVariant.id;
            } else {
              const defaultSku = `PROD-${product.id}`;
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
      if (error.message && error.message.includes("price set")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  // ==================== PUBLISH ====================
  async publish(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      await validateAllVariantsHaveStock(id);

      const product = await prisma.product.update({
        where: { id },
        data: { isPublished: true },
      });
      res.json({
        success: true,
        data: product,
        message: "Product published successfully",
      });
    } catch (error: any) {
      console.error("Publish error:", error);
      if (error.message && error.message.includes("price set")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({
        success: false,
        message: error.message || "Failed to publish product",
      });
    }
  },

  // ==================== DELETE (FIXED - removes variant images too) ====================
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: { variants: true },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

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

      // ---- DELETE IMAGES FROM DISK ----
      // 1. Delete product thumbnail
      if (product.thumbnail) {
        const filename = product.thumbnail.split("/").pop();
        if (filename) {
          const filePath = path.join(
            process.cwd(),
            "public/uploads/product-images",
            filename,
          );
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (err) {
            console.warn("Failed to delete thumbnail:", filename);
          }
        }
      }

      // 2. Delete variant images
      const variants = await prisma.variant.findMany({
        where: { productId: id },
        select: { images: true },
      });
      for (const variant of variants) {
        const images = variant.images as any[];
        if (images && images.length > 0) {
          for (const img of images) {
            const filename = img.imgUrl.split("/").pop();
            if (filename) {
              const filePath = path.join(
                process.cwd(),
                "public/uploads/product-images",
                filename,
              );
              try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              } catch (err) {
                console.warn("Failed to delete variant image:", filename);
              }
            }
          }
        }
      }

      // ---- DELETE DATABASE RECORDS ----
      await prisma.$transaction(async (tx) => {
        const variantIds = product.variants.map((v) => v.id);
        if (variantIds.length) {
          await tx.stockMovement.deleteMany({
            where: { stock: { variantId: { in: variantIds } } },
          });
          await tx.stock.deleteMany({
            where: { variantId: { in: variantIds } },
          });
          await tx.variant.deleteMany({
            where: { productId: id },
          });
        }
        await tx.productSupplier.deleteMany({ where: { productId: id } });
        await tx.manufacture.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });

      res.json({
        success: true,
        message:
          "Product, variants, stocks, and related records deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete product error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete product",
      });
    }
  },

  // ==================== ADVANCED FILTER ====================
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
        conditions.push(`(p.name LIKE ? OR p.slug LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`);
      }
      if (categoryId) {
        conditions.push(`p.category_id = ?`);
        params.push(categoryId);
      }

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
          p.name,
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
        GROUP BY p.id, p.name, p.category_id, c.name
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

  // ==================== RELATED PRODUCTS ====================
  async getRelatedProducts(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const relatedProducts = await prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          id: { not: productId },
          isPublished: true,
        },
        take: 10,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              attributePriority: true,
            },
          },
          variants: {
            include: {
              stocks: {
                select: {
                  id: true,
                  currentQty: true,
                  sellingPrice: true,
                  discountPercent: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const transformed = relatedProducts.map((p) =>
        transformProductForPublic(p),
      );
      res.json({ success: true, data: transformed });
    } catch (error: any) {
      console.error("Get related products error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch related products",
      });
    }
  },
  // ==================== TOGGLE PUBLISH ====================
  async togglePublish(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const newStatus = !product.isPublished;

      // Only enforce the "every variant needs a price set" rule when publishing
      if (newStatus) {
        await validateAllVariantsHaveStock(id);
      }

      const updated = await prisma.product.update({
        where: { id },
        data: { isPublished: newStatus },
      });

      res.json({
        success: true,
        data: updated,
        message: newStatus
          ? "Product published successfully"
          : "Product unpublished successfully",
      });
    } catch (error: any) {
      console.error("Toggle publish error:", error);
      if (error.message && error.message.includes("price set")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update publish status",
      });
    }
  },
};
