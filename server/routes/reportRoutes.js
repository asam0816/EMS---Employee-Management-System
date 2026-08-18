import { Router } from "express";
import { protect } from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";

import {
  getAdminMonthlyAttendance,
  getAdminEmployeeMonthlyDetail,
} from "../controllers/adminAttendanceReportController.js";

const router = Router();

router.get(
  "/admin-attendance",
  protect,
  requireAdmin,
  getAdminMonthlyAttendance,
);

router.get(
  "/admin-attendance/:employeeId",
  protect,
  requireAdmin,
  getAdminEmployeeMonthlyDetail,
);

export default router;
