// server/middleware/requireAdmin.js
export const requireAdmin = (req, res, next) => {
  if (!req.session?.role)
    return res.status(401).json({ error: "Unauthorized" });
  if (req.session.role !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  next();
};
