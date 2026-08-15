import AuditLog from "../models/AuditLog.js";

export const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      q = "",
      action = "",
      entityType = "",
      performedBy = "",
      startDate = "",
      endDate = "",
    } = req.query;

    const where = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (performedBy) where.performedBy = performedBy;

    if (q && String(q).trim()) {
      const search = String(q).trim();
      where.$or = [
        { action: { $regex: search, $options: "i" } },
        { entityType: { $regex: search, $options: "i" } },
        { entityLabel: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          where.createdAt.$gte = start;
        }
      }

      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          where.createdAt.$lte = end;
        }
      }
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      AuditLog.find(where)
        .populate("performedBy", "email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(where),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return res.status(500).json({
      error: "Failed to fetch audit logs",
    });
  }
};

export const getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate(
      "performedBy",
      "email role",
    );

    if (!log) {
      return res.status(404).json({
        error: "Audit log not found",
      });
    }

    return res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Get audit log by id error:", error);
    return res.status(500).json({
      error: "Failed to fetch audit log",
    });
  }
};
