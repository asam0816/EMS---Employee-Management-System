import AuditLog from "../models/AuditLog.js";

export const logAudit = async (req, payload) => {
  try {
    const session = req.session || {};

    const ipAddress =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "";

    const userAgent = req.headers["user-agent"] || "";

    await AuditLog.create({
      actorUserId: session.userId || null,
      actorEmail: session.email || "Unknown",
      actorRole: session.role || "UNKNOWN",

      action: payload.action,
      entityType: payload.entityType || "",
      entityId: payload.entityId ? String(payload.entityId) : "",
      entityLabel: payload.entityLabel || "",
      meta: payload.meta || {},

      ipAddress,
      userAgent,
    });
  } catch (err) {
    // never break your API because audit logging failed
    console.error("Audit log error:", err.message);
  }
};
