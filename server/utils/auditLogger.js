import AuditLog from "../models/AuditLog.js";

export const logAudit = async (req, payload = {}) => {
  try {
    const {
      action,
      entityType,
      entityId = null,
      entityLabel = "",
      meta = {},
    } = payload;

    if (!action || !entityType) {
      return null;
    }

    const ipAddress =
      req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      "";

    const userAgent = req?.headers?.["user-agent"] || "";

    const auditData = {
      action: String(action).trim(),
      entityType: String(entityType).trim(),
      entityId,
      entityLabel: String(entityLabel || "").trim(),
      meta: meta || {},
      performedBy: req?.session?.userId || null,
      ipAddress,
      userAgent,
    };

    const record = await AuditLog.create(auditData);
    return record;
  } catch (error) {
    console.error("Audit log error:", error);
    return null;
  }
};
