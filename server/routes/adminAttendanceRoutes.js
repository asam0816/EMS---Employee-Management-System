// server/routes/adminDashboardRoutes.js
import { Router } from "express";
import { protect } from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { getAdminDashboardSummary } from "../controllers/adminDashboardController.js";

const router = Router();

router.get("/summary", protect, requireAdmin, getAdminDashboardSummary);

export default router;
