// server/routes/attendanceRoutes.js
import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  clockInOut,
  getAttendance,
  getAttendanceStatus,
} from "../controllers/attendanceController.js";

const attendanceRouter = Router();

attendanceRouter.get("/status", protect, getAttendanceStatus);

// keep your existing endpoints
attendanceRouter.post("/", protect, clockInOut);
attendanceRouter.get("/", protect, getAttendance);

export default attendanceRouter;
