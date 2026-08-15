import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  getAuditLogs,
  getAuditLogById,
} from "../controllers/auditController.js";

const auditRouter = Router();

auditRouter.get("/", protect, protectAdmin, getAuditLogs);
auditRouter.get("/:id", protect, protectAdmin, getAuditLogById);

export default auditRouter;
