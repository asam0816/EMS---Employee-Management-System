import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getTodayAttendance,
  clockIn,
  clockOut,
  getHistory,
  clockInOut,
} from "../controllers/attendanceController.js";

const router = Router();

router.get("/today", protect, getTodayAttendance);
router.get("/history", protect, getHistory);

router.post("/clock-in", protect, clockIn);
router.post("/clock-out", protect, clockOut);

// backward compatible
router.post("/", protect, clockInOut);

export default router;
