import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import { getAdminSummary } from "../controllers/summaryController.js";

const router = Router();

// ✅ Admin only
router.get("/", protect, protectAdmin, getAdminSummary);

export default router;
