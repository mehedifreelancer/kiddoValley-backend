import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const stockController = {
  async checkSku(req: Request, res: Response) {
    const { sku } = req.query;
    if (!sku)
      return res.status(400).json({ success: false, message: "SKU required" });
    const existing = await prisma.variant.findUnique({
      where: { sku: sku as string },
    });
    res.json({ success: true, exists: !!existing });
  },

  async createStock(req: Request, res: Response) {
    try {
      const {
        variantId,
        batchNo,
        buyingOrMakingPrice,
        sellingPrice,
        discountPercent,
        quantity,
      } = req.body;

      if (
        !variantId ||
        buyingOrMakingPrice === undefined ||
        sellingPrice === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: variantId, buyingOrMakingPrice, sellingPrice",
        });
      }

      if (buyingOrMakingPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Buying price must be greater than 0",
        });
      }
      if (sellingPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "MRP must be greater than 0",
        });
      }
      const finalDiscount = discountPercent !== undefined ? discountPercent : 0;
      if (finalDiscount < 0) {
        return res.status(400).json({
          success: false,
          message: "Discount cannot be negative",
        });
      }

      const variant = await prisma.variant.findUnique({
        where: { id: variantId },
      });
      if (!variant)
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });

      const existingStock = await prisma.stock.findFirst({
        where: {
          variantId: variant.id,
          buyingOrMakingPrice: buyingOrMakingPrice,
        },
      });
      if (existingStock) {
        return res.status(400).json({
          success: false,
          message: `A price set with buying price ${buyingOrMakingPrice} already exists for this variant. Please use a different buying price.`,
        });
      }

      let finalBatchNo: string;
      const trimmedBatch = batchNo?.trim();

      if (!trimmedBatch) {
        const existingBatches = await prisma.stock.findMany({
          where: { variantId },
          select: { batchNo: true },
        });
        let maxNum = 0;
        for (const stock of existingBatches) {
          const num = parseInt(stock.batchNo, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        finalBatchNo = (maxNum + 1).toString();
      } else {
        const existingBatch = await prisma.stock.findFirst({
          where: { variantId, batchNo: trimmedBatch },
        });
        if (existingBatch) {
          return res.status(400).json({
            success: false,
            message: "Batch number already exists for this variant",
          });
        }
        finalBatchNo = trimmedBatch;
      }

      const stockQuantity = quantity && quantity > 0 ? quantity : 0;

      const newStock = await prisma.stock.create({
        data: {
          variantId,
          batchNo: finalBatchNo,
          buyingOrMakingPrice,
          sellingPrice,
          discountPercent: finalDiscount,
          currentQty: stockQuantity,
        },
      });

      if (stockQuantity > 0) {
        await prisma.stockMovement.create({
          data: {
            stockId: newStock.id,
            productId: variant.productId,
            type: "PURCHASE",
            quantity: stockQuantity,
            reason: "Stock addition",
            createdBy: (req as any).admin?.id,
          },
        });
      }

      res.status(201).json({ success: true, data: newStock });
    } catch (error: any) {
      console.error("Create stock error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async reduceStock(req: Request, res: Response) {
    try {
      const { stockId, quantity, reason, saleId } = req.body;
      if (!stockId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid stockId and quantity required",
        });
      }

      const stock = await prisma.stock.findUnique({ where: { id: stockId } });
      if (!stock)
        return res
          .status(404)
          .json({ success: false, message: "Stock not found" });
      if (stock.currentQty < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${stock.currentQty}`,
        });
      }

      const updated = await prisma.stock.update({
        where: { id: stockId },
        data: { currentQty: { decrement: quantity } },
      });

      const variant = await prisma.variant.findUnique({
        where: { id: stock.variantId },
      });
      await prisma.stockMovement.create({
        data: {
          stockId,
          productId: variant!.productId,
          type: saleId ? "SALE" : "ADJUSTMENT",
          quantity: -quantity,
          reason: reason || "Stock reduction",
          referenceId: saleId || undefined,
          createdBy: (req as any).admin?.id,
        },
      });

      res.json({
        success: true,
        message: `Removed ${quantity} from stock`,
        data: updated,
      });
    } catch (error: any) {
      console.error("Reduce stock error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async changeSellingPrice(req: Request, res: Response) {
    try {
      const { stockId, newSellingPrice, newBuyingPrice, reason } = req.body;
      if (!stockId || !newSellingPrice) {
        return res.status(400).json({
          success: false,
          message: "stockId and newSellingPrice required",
        });
      }

      const oldStock = await prisma.stock.findUnique({
        where: { id: stockId },
      });
      if (!oldStock)
        return res
          .status(404)
          .json({ success: false, message: "Stock not found" });

      let nextBatchNo = "1";
      const match = oldStock.batchNo.match(/^(\d+)/);
      if (match) {
        nextBatchNo = (parseInt(match[1]) + 1).toString();
      } else {
        nextBatchNo = oldStock.batchNo + "-v2";
      }

      const newStock = await prisma.stock.create({
        data: {
          variantId: oldStock.variantId,
          batchNo: nextBatchNo,
          buyingOrMakingPrice: newBuyingPrice ?? oldStock.buyingOrMakingPrice,
          sellingPrice: newSellingPrice,
          discountPercent: oldStock.discountPercent,
          currentQty: 0,
        },
      });

      const variant = await prisma.variant.findUnique({
        where: { id: oldStock.variantId },
      });
      await prisma.stockMovement.create({
        data: {
          stockId: newStock.id,
          productId: variant!.productId,
          type: "PRICE_CHANGE",
          quantity: 0,
          reason:
            reason ||
            `Price changed from ${oldStock.sellingPrice} to ${newSellingPrice}`,
          createdBy: (req as any).admin?.id,
        },
      });

      res.json({ success: true, data: newStock });
    } catch (error: any) {
      console.error("Change price error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getStocksByVariant(req: Request, res: Response) {
    try {
      const variantId = parseInt(req.params.variantId);
      const stocks = await prisma.stock.findMany({
        where: { variantId },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: stocks });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getStocksByProduct(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.productId);
      const variants = await prisma.variant.findMany({
        where: { productId },
        select: { id: true },
      });
      const variantIds = variants.map((v) => v.id);
      if (variantIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const stocks = await prisma.stock.findMany({
        where: { variantId: { in: variantIds } },
        orderBy: { createdAt: "desc" },
        include: { variant: { include: { product: true } } },
      });
      res.json({ success: true, data: stocks });
    } catch (error: any) {
      console.error("Get stocks by product error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getNestedStockList(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        include: {
          variants: {
            include: {
              stocks: true,
            },
          },
        },
      });

      const result = products.map((product) => ({
        product: {
          id: product.id,
          name: product.name,
        },
        totalStock: product.variants.reduce(
          (sum, v) => sum + v.stocks.reduce((s, b) => s + b.currentQty, 0),
          0,
        ),
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          barcode: variant.barcode,
          attributes: variant.attributes,
          totalVariantStock: variant.stocks.reduce(
            (s, b) => s + b.currentQty,
            0,
          ),
          batches: variant.stocks.map((batch) => ({
            id: batch.id,
            batchNo: batch.batchNo,
            buyingOrMakingPrice: batch.buyingOrMakingPrice,
            sellingPrice: batch.sellingPrice,
            discountPercent: batch.discountPercent,
            currentQty: batch.currentQty,
            createdAt: batch.createdAt,
          })),
        })),
      }));

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Nested list error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getProductStockList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const sortStock = req.query.sortStock as string;
      const skip = (page - 1) * limit;

      let productWhere: any = {};
      if (search) {
        productWhere.OR = [{ name: { contains: search } }];
      }
      if (categoryId) productWhere.categoryId = categoryId;

      const products = await prisma.product.findMany({
        where: productWhere,
        skip,
        take: limit,
        include: {
          category: { select: { name: true } },
          variants: { include: { stocks: true } },
        },
        orderBy: { id: "asc" },
      });

      const formatted = products.map((p) => {
        const allStocks = p.variants.flatMap((v) => v.stocks);
        const total = allStocks.reduce((sum, s) => sum + s.currentQty, 0);
        const latest = allStocks.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0];
        return {
          id: p.id,
          name: p.name,
          thumbnail: p.thumbnail,
          category_id: p.categoryId,
          category_name: p.category?.name,
          total_stock: total,
          latest_buying_price: latest?.buyingOrMakingPrice || null,
          latest_selling_price: latest?.sellingPrice || null,
        };
      });

      if (sortStock === "high")
        formatted.sort((a, b) => b.total_stock - a.total_stock);
      else formatted.sort((a, b) => a.total_stock - b.total_stock);

      const total = await prisma.product.count({ where: productWhere });
      res.json({
        success: true,
        data: formatted,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async advancedFilter(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
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
        conditions.push(`(p.name LIKE ?)`);
        params.push(`%${search}%`);
      }
      if (categoryId) {
        conditions.push(`p.category_id = ?`);
        params.push(categoryId);
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
          p.thumbnail,
          p.category_id,
          c.name as category_name,
          COALESCE(SUM(s.current_qty), 0) as total_stock,
          (
            SELECT s2.selling_price 
            FROM stocks s2
            JOIN variants v2 ON v2.id = s2.variant_id
            WHERE v2.product_id = p.id
            ORDER BY s2.created_at DESC 
            LIMIT 1
          ) as latest_selling_price
        FROM products p
        LEFT JOIN variants v ON v.product_id = p.id
        LEFT JOIN stocks s ON s.variant_id = v.id
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        GROUP BY p.id, p.name, p.thumbnail, p.category_id, c.name
        ${orderClause}
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);

      const products = await prisma.$queryRawUnsafe(query, ...params);
      const countQuery = `SELECT COUNT(DISTINCT p.id) as total FROM products p ${whereClause}`;
      const countParams = params.slice(0, -2);
      const totalResult = await prisma.$queryRawUnsafe(
        countQuery,
        ...countParams,
      );
      const total = Number((totalResult as any)[0]?.total || 0);

      res.json({
        success: true,
        data: products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error("Advanced filter error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteStock(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const stock = await prisma.stock.findUnique({ where: { id } });
      if (!stock) {
        return res
          .status(404)
          .json({ success: false, message: "Stock not found" });
      }
      if (stock.currentQty > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete stock batch because it has quantity greater than 0. Please reduce stock to zero first.",
        });
      }
      await prisma.stock.delete({ where: { id } });
      res.json({ success: true, message: "Stock batch deleted" });
    } catch (error: any) {
      console.error("Delete stock error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getFlatStockList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const sortBy = (req.query.sortBy as string) || "currentQty";
      const sortOrder =
        (req.query.sortOrder as string) === "asc" ? "asc" : "desc";
      const onlyInStock = req.query.onlyInStock === "true";

      const skip = (page - 1) * limit;

      let where: any = {};
      if (onlyInStock) {
        where.currentQty = { gt: 0 };
      }

      if (search) {
        const trimmed = search.trim();
        where.OR = [
          { batchNo: { contains: trimmed } },
          { variant: { sku: { contains: trimmed } } },
          { variant: { barcode: { equals: trimmed } } },
          { variant: { product: { name: { contains: trimmed } } } },
        ];
      }

      const total = await prisma.stock.count({ where });

      let orderBy: any = {};
      if (sortBy === "variant.productName") {
        orderBy = { variant: { product: { name: sortOrder } } };
      } else if (sortBy === "variant.sku") {
        orderBy = { variant: { sku: sortOrder } };
      } else {
        orderBy = { [sortBy]: sortOrder };
      }

      const stocks = await prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          variant: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
      });

      const formatted = stocks.map((stock) => ({
        id: stock.id,
        batchNo: stock.batchNo,
        buyingPrice: stock.buyingOrMakingPrice,
        sellingPrice: stock.sellingPrice,
        discountPercent: stock.discountPercent,
        currentQty: stock.currentQty,
        createdAt: stock.createdAt,
        variant: {
          id: stock.variant.id,
          sku: stock.variant.sku,
          barcode: stock.variant.barcode,
          attributes: stock.variant.attributes,
          images: stock.variant.images,
          isImported: stock.variant.isImported,
          countryOfOrigin: stock.variant.countryOfOrigin,
          productName: stock.variant.product.name,
        },
      }));

      res.json({
        success: true,
        data: formatted,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Get flat stock list error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async stockIn(req: Request, res: Response) {
    try {
      const { supplierId, supplierName, stockInDate, items, subtotal, total } =
        req.body;

      if (!supplierId) {
        return res
          .status(400)
          .json({ success: false, message: "Supplier ID is required" });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "At least one item is required" });
      }

      for (const item of items) {
        if (!item.stockId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message:
              "Each item must have a valid stockId and positive quantity",
          });
        }
      }

      const adminId = (req as any).admin?.id;

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const stock = await tx.stock.findUnique({
            where: { id: item.stockId },
            include: { variant: { select: { productId: true } } },
          });

          if (!stock) {
            throw new Error(`Stock batch with ID ${item.stockId} not found`);
          }

          await tx.stock.update({
            where: { id: item.stockId },
            data: { currentQty: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              productId: stock.variant.productId,
              type: "PURCHASE",
              quantity: item.quantity,
              reason: `Stock in from supplier ${supplierName || `ID:${supplierId}`} on ${new Date(stockInDate).toLocaleString()}`,
              referenceId: null,
              createdBy: adminId,
            },
          });
        }
      });

      res.status(201).json({
        success: true,
        message: "Stock‑in completed successfully",
      });
    } catch (error: any) {
      console.error("Stock‑in error:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  async checkSingleStock(req: Request, res: Response) {
    try {
      const { stockId, quantity = 1 } = req.query;
      if (!stockId) {
        return res.status(400).json({
          success: false,
          message: "stockId is required",
        });
      }

      const id = parseInt(stockId as string);
      const qty = parseInt(quantity as string) || 1;

      const stock = await prisma.stock.findUnique({
        where: { id },
        include: {
          variant: {
            include: { product: true },
          },
        },
      });

      if (!stock) {
        return res.status(404).json({
          success: false,
          message: "Stock not found",
          data: { stockId: id, available: false, currentQty: 0 },
        });
      }

      const available = stock.currentQty >= qty;
      res.json({
        success: true,
        data: {
          stockId: id,
          available,
          currentQty: stock.currentQty,
          productName: stock.variant.product.name,
          message: available ? "Available" : `Only ${stock.currentQty} left`,
        },
      });
    } catch (error: any) {
      console.error("Check single stock error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async checkBulkStock(req: Request, res: Response) {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Items array required with stockId and quantity",
        });
      }

      const results = await Promise.all(
        items.map(async ({ stockId, quantity }) => {
          const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            include: {
              variant: {
                include: { product: true },
              },
            },
          });

          if (!stock) {
            return {
              stockId,
              available: false,
              currentQty: 0,
              productName: "Unknown",
              message: "Stock not found",
            };
          }

          const available = stock.currentQty >= quantity;
          return {
            stockId,
            available,
            currentQty: stock.currentQty,
            productName: stock.variant.product.name,
            message: available ? "Available" : `Only ${stock.currentQty} left`,
          };
        }),
      );

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error("Check bulk stock error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ NEW: Update only discount percent for a stock (for Edit button in wizard)
  async updateDiscount(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid stock ID" });
      }

      const { discountPercent } = req.body;

      if (discountPercent === undefined || discountPercent === null) {
        return res.status(400).json({
          success: false,
          message: "discountPercent is required",
        });
      }

      const existingStock = await prisma.stock.findUnique({
        where: { id },
      });
      if (!existingStock) {
        return res
          .status(404)
          .json({ success: false, message: "Stock not found" });
      }

      const stock = await prisma.stock.update({
        where: { id },
        data: {
          discountPercent: parseFloat(discountPercent) || 0,
        },
      });

      res.json({ success: true, data: stock });
    } catch (error: any) {
      console.error("Update stock discount error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update stock discount",
      });
    }
  },
};
