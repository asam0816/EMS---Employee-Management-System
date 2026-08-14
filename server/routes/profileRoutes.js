import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";

const profileRouter = Router();

profileRouter.get("/", protect, getProfile);
profileRouter.put("/", protect, updateProfile); // ✅ changed to PUT

export default profileRouter;
