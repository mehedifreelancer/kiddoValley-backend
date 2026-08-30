import { Router } from "express";
import { stockController } from "../../controllers/stockController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin - Stock
 *   description: Stock (batch) management (requires Bearer token)
 */

router.get("/check-sku", adminAuth, stockController.checkSku);

router.post("/add", adminAuth, stockController.createStock);

router.post("/reduce", adminAuth, stockController.reduceStock);

router.post("/change-price", adminAuth, stockController.changeSellingPrice);

router.get(
  "/variant/:variantId",
  adminAuth,
  stockController.getStocksByVariant,
);

router.get(
  "/product/:productId",
  adminAuth,
  stockController.getStocksByProduct,
);

router.get("/nested-list", adminAuth, stockController.getNestedStockList);

router.get("/list", adminAuth, stockController.getProductStockList);

router.get("/advanced-filter", adminAuth, stockController.advancedFilter);

router.delete("/:id", adminAuth, stockController.deleteStock);

router.get("/flat-list", adminAuth, stockController.getFlatStockList);

router.post("/stock-in/create", adminAuth, stockController.stockIn);

// ✅ নতুন route – stock discount update (Edit বাটনের জন্য)
router.patch("/:id/discount", adminAuth, stockController.updateDiscount);
router.post("/adjust", adminAuth, stockController.adjustStock);

export default router;
