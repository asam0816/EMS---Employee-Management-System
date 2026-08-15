import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";

import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetings,
  getMeeting,
  respondToMeeting,
  startMeeting,
  updateMeetingNotes,
  endMeeting,
} from "../controllers/meetingController.js";

const meetingRouter = Router();

meetingRouter.get("/", protect, getMeetings);
meetingRouter.post("/", protect, protectAdmin, createMeeting);

meetingRouter.put("/:id", protect, protectAdmin, updateMeeting);
meetingRouter.delete("/:id", protect, protectAdmin, deleteMeeting);

meetingRouter.get("/:id", protect, getMeeting);
meetingRouter.patch("/:id/respond", protect, respondToMeeting);
meetingRouter.patch("/:id/start", protect, startMeeting);
meetingRouter.put("/:id/notes", protect, protectAdmin, updateMeetingNotes);
meetingRouter.patch("/:id/end", protect, protectAdmin, endMeeting);

export default meetingRouter;
