import AuditLog from "../models/AuditLog.js";

const buildFilter = (query) => {
  const { q, action, from, to } = query;
  const filter = {};

  if (action) filter.action = action;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  if (q) {
    const regex = new RegExp(q, "i");
    filter.$or = [
      { actorEmail: regex },
      { actorRole: regex },
      { action: regex },
      { entityType: regex },
      { entityLabel: regex },
      { ipAddress: regex },
    ];
  }

  return filter;
};

// GET /api/audit (ADMIN only)
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;

    const filter = buildFilter(req.query);

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: logs.map((l) => ({ ...l, id: l._id.toString() })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("getAuditLogs error:", err);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
};

// GET /api/audit/export (ADMIN only) -> CSV download
export const exportAuditLogsCSV = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).lean();

    const headers = [
      "Timestamp",
      "Actor Email",
      "Actor Role",
      "Action",
      "Entity Type",
      "Entity Id",
      "Entity Label",
      "IP Address",
    ];

    const esc = (v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;

    const rows = logs.map((l) =>
      [
        esc(new Date(l.createdAt).toISOString()),
        esc(l.actorEmail),
        esc(l.actorRole),
        esc(l.action),
        esc(l.entityType),
        esc(l.entityId),
        esc(l.entityLabel),
        esc(l.ipAddress),
      ].join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit_logs_${new Date().toISOString().slice(0, 10)}.csv"`,
    );

    return res.send(csv);
  } catch (err) {
    console.error("exportAuditLogsCSV error:", err);
    return res.status(500).json({ error: "Failed to export audit logs" });
  }
};
