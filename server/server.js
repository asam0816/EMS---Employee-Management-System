import express from "express";
import cors from "cors";
import "dotenv/config";
import multer from "multer";
import connectDB from "./config/db.js";

import authRouter from "./routes/authRoutes.js";
import employeesRouter from "./routes/employeeRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import leaveRouter from "./routes/leaveRoutes.js";
import payslipRouter from "./routes/payslipsRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";
import auditRouter from "./routes/auditRoutes.js";
import idCardRouter from "./routes/idCardRoutes.js";
import meetingRouter from "./routes/meetingRoutes.js";
import { startAutoCheckoutJob } from "./jobs/autoCheckoutJob.js";

import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware (limits MUST be before routes)
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ✅ Multer with bigger field size (for any FormData requests)
const upload = multer({
  limits: { fieldSize: 20 * 1024 * 1024 }, // 20MB
});
app.use(upload.none());

// ✅ Routes
app.get("/", (req, res) => res.send("Server is running"));
app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/profile", profileRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/payslips", payslipRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit", auditRouter);
app.use("/api/id-cards", idCardRouter);
app.use("/api/meetings", meetingRouter);

app.use("/api/inngest", serve({ client: inngest, functions }));

await connectDB();

// ✅ start cron AFTER DB connection
startAutoCheckoutJob();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
