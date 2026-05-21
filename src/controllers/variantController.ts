import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { saveImagesToDisk } from "../multer";
import path from "path";
import { deleteFiles } from "../utils/fileUtils";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateVariantSku(
  productSlug: string,
  attributes: Record<string, string>,
): string {
  const base = `kdv-${productSlug}`;
  const attrPart = Object.values(attributes)
    .map((v) => slugify(v))
    .join("-");
  return attrPart ? `${base}-${attrPart}` : base;
}

export const variantController = {
  // Create a new variant (with optional images, isImported)
  async create(req: Request, res: Response) {
    let savedFilenames: string[] = [];

    try {
      const {
        productId,
        attributes,
        isImported,
        countryOfOrigin,
        buyingPrice,
        sellingPrice,
        discountPercent,
        initialQuantity,
      } = req.body;

      const files = req.files as Express.Multer.File[];

      if (!productId) {
        return res
          .status(400)
          .json({ success: false, message: "Product ID required" });
      }
      const productIdNum = parseInt(productId);
      if (isNaN(productIdNum)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const product = await prisma.product.findUnique({
        where: { id: productIdNum },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const parsedAttributes = attributes
        ? typeof attributes === "string"
          ? JSON.parse(attributes)
          : attributes
        : {};

      const sku = generateVariantSku(product.slug, parsedAttributes);
      const existing = await prisma.variant.findUnique({ where: { sku } });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Variant SKU already exists" });
      }

      // Save variant images (max 3)
      let finalImages: any[] = [];
      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        finalImages = savedFilenames.map((filename) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${filename}`,
        }));
      }

      const result = await prisma.$transaction(async (tx) => {
        const variant = await tx.variant.create({
          data: {
            sku,
            productId: productIdNum,
            attributes: parsedAttributes,
            images: finalImages.length ? finalImages : undefined,
            isImported: isImported === true || isImported === "true",
            countryOfOrigin: countryOfOrigin || null,
          },
        });

        // Placeholder manufacture record
        await tx.manufacture.create({
          data: {
            productId: productIdNum,
            variantId: variant.id,
            totalQuantity: 0,
            costComponents: [],
            totalCost: 0,
            unitCost: 0,
          },
        });

        // Optional initial stock batch
        if (
          buyingPrice &&
          sellingPrice &&
          initialQuantity &&
          initialQuantity > 0
        ) {
          await tx.stock.create({
            data: {
              variantId: variant.id,
              batchNo: "1",
              buyingOrMakingPrice: parseFloat(buyingPrice),
              sellingPrice: parseFloat(sellingPrice),
              discountPercent: parseInt(discountPercent) || 0,
              currentQty: parseInt(initialQuantity),
            },
          });
        }

        return variant;
      });

      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (savedFilenames.length) {
        const paths = savedFilenames.map((f) =>
          path.join(process.cwd(), "public/uploads/product-images", f),
        );
        deleteFiles(paths);
      }
      console.error("Create variant error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create a default variant (no attributes)
  async createDefault(req: Request, res: Response) {
    try {
      const { productId, isImported, countryOfOrigin } = req.body;
      if (!productId) {
        return res
          .status(400)
          .json({ success: false, message: "Product ID required" });
      }
      const productIdNum = parseInt(productId);
      if (isNaN(productIdNum)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid product ID" });
      }

      const product = await prisma.product.findUnique({
        where: { id: productIdNum },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const sku = `kdv-${product.slug}`;
      const existing = await prisma.variant.findUnique({ where: { sku } });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Default variant already exists" });
      }

      await prisma.$transaction(async (tx) => {
        const variant = await tx.variant.create({
          data: {
            sku,
            productId: productIdNum,
            attributes: {},
            isImported: isImported === true || isImported === "true",
            countryOfOrigin: countryOfOrigin || null,
          },
        });
        await tx.manufacture.create({
          data: {
            productId: productIdNum,
            variantId: variant.id,
            totalQuantity: 0,
            costComponents: [],
            totalCost: 0,
            unitCost: 0,
          },
        });
      });

      res
        .status(201)
        .json({ success: true, message: "Default variant created" });
    } catch (error: any) {
      console.error("Create default variant error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all variants of a product (including their stock batches)
  async getByProduct(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.productId);
      const variants = await prisma.variant.findMany({
        where: { productId },
        include: { stocks: true },
        orderBy: { createdAt: "asc" },
      });
      res.json({ success: true, data: variants });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ UPDATED: Update variant with proper image merging – NEVER wipe unless intended
  async update(req: Request, res: Response) {
    let savedFilenames: string[] = [];
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ success: false, message: "Invalid ID" });

      const { attributes, isImported, countryOfOrigin, existingImages } =
        req.body;
      const files = req.files as Express.Multer.File[];

      const existingVariant = await prisma.variant.findUnique({
        where: { id },
      });
      if (!existingVariant)
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });

      // ---------- IMAGE MERGING STRATEGY ----------
      // 1. Start with the current images in database (ensure it's an array)
      let finalImages: any[] = Array.isArray(existingVariant.images)
        ? (existingVariant.images as any[])
        : [];

      // 2. If the client sent an `existingImages` field, replace the list with that
      if (existingImages !== undefined) {
        const parsed =
          typeof existingImages === "string"
            ? JSON.parse(existingImages)
            : existingImages;
        finalImages = Array.isArray(parsed) ? parsed : [];
      }

      // 3. Add any newly uploaded files
      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        const newUrls = savedFilenames.map((filename) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${filename}`,
        }));
        finalImages.push(...newUrls);
      }

      const updateData: any = {};
      if (attributes !== undefined) {
        updateData.attributes =
          typeof attributes === "string" ? JSON.parse(attributes) : attributes;
      }
      if (isImported !== undefined)
        updateData.isImported = isImported === true || isImported === "true";
      if (countryOfOrigin !== undefined)
        updateData.countryOfOrigin = countryOfOrigin;
      updateData.images = finalImages; // always set (may be the same as before or modified)

      const updated = await prisma.variant.update({
        where: { id },
        data: updateData,
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (savedFilenames.length) {
        const paths = savedFilenames.map((f) =>
          path.join(process.cwd(), "public/uploads/product-images", f),
        );
        deleteFiles(paths);
      }
      console.error("Update variant error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // Delete variant (only if no stock batches)
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const variant = await prisma.variant.findUnique({
        where: { id },
        include: { stocks: true },
      });
      if (!variant)
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });
      if (variant.stocks.some((s) => s.currentQty > 0)) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete variant with existing stock",
        });
      }
      await prisma.$transaction([
        prisma.manufacture.deleteMany({ where: { variantId: id } }),
        prisma.variant.delete({ where: { id } }),
      ]);
      res.json({ success: true, message: "Variant deleted" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
