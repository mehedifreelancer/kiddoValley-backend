import { Router } from "express";
import { dashboardController } from "../../controllers/dashboardController";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

router.get("/overview", adminAuth, dashboardController.getOverview);
router.get("/sales-trend", adminAuth, dashboardController.getSalesTrend);
router.get("/best-products", adminAuth, dashboardController.getBestProducts);
router.get("/category-sales", adminAuth, dashboardController.getCategorySales);
router.get("/top-customers", adminAuth, dashboardController.getTopCustomers);
router.get("/heatmap", adminAuth, dashboardController.getHeatmap);
router.get("/retention", adminAuth, dashboardController.getRetention);
router.get("/payment-status", adminAuth, dashboardController.getPaymentStatus);
router.get("/order-status", adminAuth, dashboardController.getOrderStatus);
router.get(
  "/top-profit-products",
  adminAuth,
  dashboardController.getTopProfitProducts,
);
router.get("/product-sales", adminAuth, dashboardController.getProductSales);
router.get("/sales-vs-profit", adminAuth, dashboardController.getSalesVsProfit);
router.get("/order-traffic", adminAuth, dashboardController.getOrderTraffic);

export default router;
