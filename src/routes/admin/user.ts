import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth";
import { allowRoles } from "../../middleware/roleAuth";
import { userController } from "../../controllers/userController";

const router = Router();

router.get(
  "/",
  adminAuth,
  allowRoles(["super_admin", "admin"]),
  userController.getUsers,
);
router.post(
  "/",
  adminAuth,
  allowRoles(["super_admin", "admin"]),
  userController.createUser,
);
router.put(
  "/:id",
  adminAuth,
  allowRoles(["super_admin", "admin"]),
  userController.updateUser,
);
router.delete(
  "/:id",
  adminAuth,
  allowRoles(["super_admin"]),
  userController.deleteUser,
);

export default router;
