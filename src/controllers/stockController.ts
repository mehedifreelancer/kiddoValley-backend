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
        quantity, // now optional
      } = req.body;

      // Quantity is no longer required; we only require variantId, buyingPrice, sellingPrice
      if (!variantId || !buyingOrMakingPrice || !sellingPrice) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Missing required fields (variantId, buyingOrMakingPrice, sellingPrice)",
          });
      }

      const variant = await prisma.variant.findUnique({
        where: { id: variantId },
      });
      if (!variant)
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });

      // Optional batchNo uniqueness check
      if (batchNo) {
        const existingBatch = await prisma.stock.findFirst({
          where: { variantId, batchNo },
        });
        if (existingBatch) {
          return res.status(400).json({
            success: false,
            message: "Batch number already exists for this variant",
          });
        }
      }

      const stockQuantity = quantity && quantity > 0 ? quantity : 0;

      const newStock = await prisma.stock.create({
        data: {
          variantId,
          batchNo: batchNo || "1",
          buyingOrMakingPrice,
          sellingPrice,
          discountPercent: discountPercent || 0,
          currentQty: stockQuantity,
        },
      });

      // Only create stock movement if actual stock was added (quantity > 0)
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
          barcode: variant.barcode, // variant barcode
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
          images: p.images,
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
          p.images,
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
        GROUP BY p.id, p.name, p.images, p.category_id, c.name
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
};
