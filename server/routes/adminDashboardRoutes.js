// server/routes/adminDashboardRoutes.js
import { Router } from "express";
import { protect } from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { getAdminDashboardSummary } from "../controllers/adminDashboardController.js";

const router = Router();

// GET /api/admin-dashboard/summary?month=YYYY-MM
router.get("/summary", protect, requireAdmin, getAdminDashboardSummary);

export default router;
