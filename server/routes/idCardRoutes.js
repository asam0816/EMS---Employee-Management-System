import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  getAllEmployeeIdCards,
  getEmployeeIdCardById,
} from "../controllers/idCardController.js";

const idCardRouter = Router();

idCardRouter.get("/", protect, protectAdmin, getAllEmployeeIdCards);
idCardRouter.get("/:id", protect, protectAdmin, getEmployeeIdCardById);

export default idCardRouter;
