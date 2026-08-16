import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { allowRoles } from "../../middleware/roleAuth";
import { formulaController } from "../../controllers/formulaController";

const router = Router();
router.get(
  "/",
  adminAuth,
  allowRoles(["super_admin", "admin", "data_accountant"]),
  formulaController.getFormulas,
);
router.post(
  "/",
  adminAuth,
  allowRoles(["super_admin", "admin", "data_accountant"]),
  formulaController.createFormula,
);
router.put(
  "/:id",
  adminAuth,
  allowRoles(["super_admin", "admin", "data_accountant"]),
  formulaController.updateFormula,
);
router.delete(
  "/:id",
  adminAuth,
  allowRoles(["super_admin", "admin"]),
  formulaController.deleteFormula,
);

export default router;
