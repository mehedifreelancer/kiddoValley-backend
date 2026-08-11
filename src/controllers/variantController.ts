import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { saveImagesToDisk } from "../multer";
import path from "path";
import { deleteFiles } from "../utils/fileUtils";
import fs from "fs";
import { generateSlug } from "../utils/slugify";

function generateVariantSku(
  productSlug: string,
  attributes: Record<string, string>,
): string {
  const base = `kdv-${productSlug}`;
  // Sort attribute keys alphabetically for consistent order
  const sortedKeys = Object.keys(attributes).sort();
  const attrPart = sortedKeys
    .map((key) => generateSlug(attributes[key]))
    .join("-");
  return attrPart ? `${base}-${attrPart}` : base;
}

export const variantController = {
  async create(req: Request, res: Response) {
    let savedFilenames: string[] = [];

    try {
      const {
        productId,
        attributes,
        isImported,
        countryOfOrigin,
        barcode,
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

      if (barcode) {
        const existingBarcode = await prisma.variant.findUnique({
          where: { barcode: barcode as string },
        });
        if (existingBarcode) {
          return res
            .status(400)
            .json({ success: false, message: "Barcode already exists" });
        }
      }

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
            barcode: barcode || null,
            productId: productIdNum,
            attributes: parsedAttributes,
            images: finalImages.length ? finalImages : undefined,
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

  async createDefault(req: Request, res: Response) {
    try {
      const { productId, isImported, countryOfOrigin, barcode } = req.body;
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

      if (barcode) {
        const existingBarcode = await prisma.variant.findUnique({
          where: { barcode },
        });
        if (existingBarcode) {
          return res
            .status(400)
            .json({ success: false, message: "Barcode already exists" });
        }
      }

      await prisma.$transaction(async (tx) => {
        const variant = await tx.variant.create({
          data: {
            sku,
            barcode: barcode || null,
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

  async getOne(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const variant = await prisma.variant.findUnique({
        where: { id },
        include: { stocks: true },
      });
      if (!variant) {
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });
      }
      res.json({ success: true, data: variant });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    let savedFilenames: string[] = [];
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ success: false, message: "Invalid ID" });

      // ✅ Add 'barcode' to destructuring
      const {
        attributes,
        isImported,
        countryOfOrigin,
        existingImages,
        barcode,
      } = req.body;

      // Normalize files
      let files: Express.Multer.File[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) files = req.files;
        else if (req.files.images) files = req.files.images;
      }

      const existingVariant = await prisma.variant.findUnique({
        where: { id },
        include: { product: true },
      });
      if (!existingVariant)
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });

      // Image handling (unchanged – keep your existing code)
      const currentImages = Array.isArray(existingVariant.images)
        ? existingVariant.images
        : [];
      let finalImages: any[] = [];
      if (existingImages !== undefined) {
        const parsed =
          typeof existingImages === "string"
            ? JSON.parse(existingImages)
            : existingImages;
        finalImages = Array.isArray(parsed) ? parsed : [];
      } else {
        finalImages = [...currentImages];
      }
      if (files && files.length > 0) {
        savedFilenames = saveImagesToDisk(files);
        const newUrls = savedFilenames.map((filename) => ({
          imgUrl: `${req.protocol}://${req.get("host")}/uploads/product-images/${filename}`,
        }));
        finalImages.push(...newUrls);
      }

      // Delete orphaned images
      const oldUrls = currentImages.map((img: any) => img.imgUrl);
      const newUrlsList = finalImages.map((img) => img.imgUrl);
      const removedUrls = oldUrls.filter((url) => !newUrlsList.includes(url));
      for (const url of removedUrls) {
        const filename = url.split("/").pop();
        if (filename) {
          const filePath = path.join(
            process.cwd(),
            "public/uploads/product-images",
            filename,
          );
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.warn("Failed to delete:", filename);
          }
        }
      }

      // Build update data
      const updateData: any = {};
      let attributesChanged = false;
      if (attributes !== undefined) {
        const parsedAttrs =
          typeof attributes === "string" ? JSON.parse(attributes) : attributes;
        updateData.attributes = parsedAttrs;
        attributesChanged = true;
      }
      if (isImported !== undefined)
        updateData.isImported = isImported === true || isImported === "true";
      if (countryOfOrigin !== undefined)
        updateData.countryOfOrigin = countryOfOrigin;
      // ✅ Add barcode to update data
      if (barcode !== undefined) updateData.barcode = barcode;
      updateData.images = finalImages;

      // Regenerate SKU only if attributes changed
      if (attributesChanged) {
        const product = existingVariant.product;
        const newSku = generateVariantSku(product.slug, updateData.attributes);
        const existingSku = await prisma.variant.findUnique({
          where: { sku: newSku },
        });
        if (!existingSku || existingSku.id === id) {
          updateData.sku = newSku;
        } else {
          updateData.sku = `${newSku}-${Date.now()}`;
        }
      }

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
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const variant = await prisma.variant.findUnique({
        where: { id },
        include: { stocks: true },
      });
      if (!variant) {
        return res
          .status(404)
          .json({ success: false, message: "Variant not found" });
      }
      // ✅ Prevent deletion if any stock batch has currentQty > 0
      if (variant.stocks.some((s) => s.currentQty > 0)) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete variant because it has stock with positive quantity. Please reduce stock to zero first.",
        });
      }
      // Delete images from disk (your existing code)
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
              fs.unlinkSync(filePath);
            } catch (err) {}
          }
        }
      }
      await prisma.$transaction([
        prisma.manufacture.deleteMany({ where: { variantId: id } }),
        prisma.variant.delete({ where: { id } }),
      ]);
      res.json({ success: true, message: "Variant deleted" });
    } catch (error: any) {
      console.error("Delete variant error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
