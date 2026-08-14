import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorEmail: { type: String, default: "Unknown" },
    actorRole: { type: String, default: "UNKNOWN" }, // ADMIN / EMPLOYEE

    action: { type: String, required: true }, // e.g. EMPLOYEE_CREATED
    entityType: { type: String, default: "" }, // Employee / LeaveApplication / Profile
    entityId: { type: String, default: "" },
    entityLabel: { type: String, default: "" },

    meta: { type: Object, default: {} }, // store extra info

    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
