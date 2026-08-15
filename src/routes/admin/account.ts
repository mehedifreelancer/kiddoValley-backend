import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { accountController } from "../../controllers/accountController";
import { reportController } from "../../controllers/reportController";

const router = Router();

// ==================== Transaction Category ====================
router.get("/categories", adminAuth, accountController.getCategories);
router.post("/categories", adminAuth, accountController.createCategory);
router.put("/categories/:id", adminAuth, accountController.updateCategory);
router.delete("/categories/:id", adminAuth, accountController.deleteCategory);

// ==================== Transactions ====================
router.get("/transactions", adminAuth, accountController.getTransactions);
router.post("/transactions", adminAuth, accountController.createTransaction);
router.put("/transactions/:id", adminAuth, accountController.updateTransaction);
router.delete(
  "/transactions/:id",
  adminAuth,
  accountController.deleteTransaction,
);

// ==================== Dashboard Summary ====================
router.get("/dashboard", adminAuth, accountController.getDashboardSummary);

// ==================== Annual Report ====================
router.get("/annual-report", adminAuth, reportController.getAnnualReport);
router.get("/categories/all", adminAuth, accountController.getAllCategories);

router.get("/assets", adminAuth, accountController.getAssets);
router.post("/assets", adminAuth, accountController.createAsset);
router.put("/assets/:id", adminAuth, accountController.updateAsset);
router.delete("/assets/:id", adminAuth, accountController.deleteAsset);
router.post("/assets/sell/:id", adminAuth, accountController.sellAsset);
router.get("/balance-summary", adminAuth, accountController.getBalanceSummary);

// Employee Bills
router.get("/employee-bills", adminAuth, accountController.getEmployeeBills);
router.post("/employee-bills", adminAuth, accountController.createEmployeeBill);
router.put(
  "/employee-bills/:id",
  adminAuth,
  accountController.updateEmployeeBill,
);
router.delete(
  "/employee-bills/:id",
  adminAuth,
  accountController.deleteEmployeeBill,
);

// Raw Materials
router.get("/raw-materials", adminAuth, accountController.getRawMaterials);
router.post("/raw-materials", adminAuth, accountController.createRawMaterial);
router.put(
  "/raw-materials/:id",
  adminAuth,
  accountController.updateRawMaterial,
);
router.delete(
  "/raw-materials/:id",
  adminAuth,
  accountController.deleteRawMaterial,
);

export default router;
