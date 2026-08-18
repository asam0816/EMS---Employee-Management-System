import User from "../models/User.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req?.session?.userId || req?.user?.id || req?.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(userId).select("role").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (String(user.role).toUpperCase() !== "ADMIN") {
      return res.status(403).json({ error: "Admin only" });
    }

    next();
  } catch (e) {
    console.error("requireAdmin error:", e);
    return res.status(500).json({ error: "Authorization failed" });
  }
};

export default requireAdmin;
