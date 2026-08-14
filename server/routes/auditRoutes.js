import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  getAuditLogs,
  exportAuditLogsCSV,
} from "../controllers/auditController.js";

const auditRouter = Router();

auditRouter.get("/", protect, protectAdmin, getAuditLogs);
auditRouter.get("/export", protect, protectAdmin, exportAuditLogsCSV);

export default auditRouter;
