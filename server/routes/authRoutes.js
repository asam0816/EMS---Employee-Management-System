import { Router } from "express";
import { protect } from "../middleware/auth.js";

import {
  login,
  session,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
} from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.get("/session", protect, session);
router.post("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/logout", protect, logout); // ✅ important

export default router;
