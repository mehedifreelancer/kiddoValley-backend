import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const manufactureController = {
  async create(req: Request, res: Response) {
    try {
      const {
        productId,
        variantId,
        totalQuantity,
        costComponents,
        notes,
        manufactureDate,
      } = req.body;

      if (
        !productId ||
        !totalQuantity ||
        !costComponents ||
        !Array.isArray(costComponents)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      let targetVariantId = variantId;
      if (!targetVariantId) {
        const defaultVariant = await prisma.variant.findFirst({
          where: { productId, attributes: {} },
        });
        if (defaultVariant) {
          targetVariantId = defaultVariant.id;
        } else {
          const product = await prisma.product.findUnique({
            where: { id: productId },
          });
          if (!product) throw new Error("Product not found");
          const defaultSku = product.barcode || `PROD-${productId}`;
          const newVariant = await prisma.variant.create({
            data: { sku: defaultSku, productId, attributes: {} },
          });
          targetVariantId = newVariant.id;
        }
      }

      const totalCost = costComponents.reduce(
        (sum: number, item: any) => sum + (item.cost || 0),
        0,
      );
      const unitCost = totalCost / totalQuantity;

      const manufacture = await prisma.manufacture.create({
        data: {
          productId,
          variantId: targetVariantId,
          totalQuantity,
          costComponents,
          notes,
          totalCost,
          unitCost,
          manufactureDate: manufactureDate
            ? new Date(manufactureDate)
            : new Date(),
        },
      });

      // Create a stock batch
      const lastBatch = await prisma.stock.findFirst({
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

      await prisma.stock.create({
        data: {
          variantId: targetVariantId,
          batchNo: nextBatchNo,
          buyingOrMakingPrice: unitCost,
          sellingPrice: 0,
          discountPercent: 0,
          currentQty: totalQuantity,
        },
      });

      res.status(201).json({ success: true, data: manufacture });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const { productId, variantId } = req.query;
      const where: any = {};
      if (productId) where.productId = parseInt(productId as string);
      if (variantId) where.variantId = parseInt(variantId as string);

      const manufactures = await prisma.manufacture.findMany({
        where,
        include: {
          product: { select: { name: true, barcode: true } }, // ✅ now works
        },
        orderBy: { manufactureDate: "desc" },
      });
      res.json({ success: true, data: manufactures });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const manufacture = await prisma.manufacture.findUnique({
        where: { id },
        include: { product: true }, // ✅ now works
      });
      if (!manufacture)
        return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, data: manufacture });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { totalQuantity, costComponents, notes } = req.body;

      const existing = await prisma.manufacture.findUnique({ where: { id } });
      if (!existing)
        return res
          .status(404)
          .json({ success: false, message: "Manufacture not found" });

      let updateData: any = { notes };
      if (totalQuantity !== undefined) updateData.totalQuantity = totalQuantity;
      if (costComponents !== undefined) {
        updateData.costComponents = costComponents;
        const totalCost = costComponents.reduce(
          (sum: number, item: any) => sum + (item.cost || 0),
          0,
        );
        updateData.totalCost = totalCost;
        const qty =
          totalQuantity !== undefined ? totalQuantity : existing.totalQuantity;
        updateData.unitCost = totalCost / qty;
      }

      const updated = await prisma.manufacture.update({
        where: { id },
        data: updateData,
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const manufacture = await prisma.manufacture.findUnique({
        where: { id },
      });
      if (!manufacture)
        return res.status(404).json({ success: false, message: "Not found" });
      await prisma.manufacture.delete({ where: { id } });
      res.json({ success: true, message: "Manufacture deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
