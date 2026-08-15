import crypto from "crypto";
import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import Employee from "../models/Employee.js";
import { logAudit } from "../utils/auditLogger.js";

const getEmployeeForUser = async (userId) => {
  return Employee.findOne({
    userId,
    isDeleted: { $ne: true },
    employmentStatus: "ACTIVE",
  });
};

const canAccessMeeting = async (req, meeting) => {
  if (req.session?.role === "ADMIN") {
    return true;
  }

  const employee = await getEmployeeForUser(req.session?.userId);

  if (!employee) {
    return false;
  }

  if (meeting.audience === "ALL") {
    return true;
  }

  const meetingEmployeeId = meeting.employeeId?._id || meeting.employeeId;
  return String(meetingEmployeeId) === String(employee._id);
};

const addOrUpdateParticipant = async (meeting, employeeId) => {
  if (!employeeId) return;

  const now = new Date();

  if (!Array.isArray(meeting.participants)) {
    meeting.participants = [];
  }

  const existingIndex = meeting.participants.findIndex(
    (p) => String(p.employeeId) === String(employeeId),
  );

  if (existingIndex >= 0) {
    meeting.participants[existingIndex].lastSeenAt = now;
    if (!meeting.participants[existingIndex].joinedAt) {
      meeting.participants[existingIndex].joinedAt = now;
    }
  } else {
    meeting.participants.push({
      employeeId,
      joinedAt: now,
      leftAt: null,
      lastSeenAt: now,
    });
  }
};

const serializeMeeting = (meeting) => {
  const obj = meeting.toObject ? meeting.toObject() : meeting;

  return {
    ...obj,
    id: obj._id?.toString?.() || obj.id,
    audience: obj.audience || "INDIVIDUAL",
    participantsCount: Array.isArray(obj.participants)
      ? obj.participants.length
      : 0,
    canStartNow: new Date(obj.scheduledAt).getTime() <= Date.now(),
  };
};

// POST /api/meetings
// ADMIN only
export const createMeeting = async (req, res) => {
  try {
    if (req.session?.role !== "ADMIN") {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const { audience, employeeId, title, type, scheduledAt, durationMinutes } =
      req.body;

    if (!title || !scheduledAt) {
      return res.status(400).json({
        error: "Meeting title and date/time are required",
      });
    }

    const isAllMeeting = audience === "ALL" || employeeId === "ALL";
    const meetingAudience = isAllMeeting ? "ALL" : "INDIVIDUAL";

    let employee = null;

    if (meetingAudience === "INDIVIDUAL") {
      if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({
          error: "Please select a valid employee",
        });
      }

      employee = await Employee.findOne({
        _id: employeeId,
        isDeleted: { $ne: true },
        employmentStatus: "ACTIVE",
      });

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found",
        });
      }
    }

    const meetingDate = new Date(scheduledAt);

    if (Number.isNaN(meetingDate.getTime())) {
      return res.status(400).json({
        error: "Invalid meeting date",
      });
    }

    if (meetingDate.getTime() < Date.now()) {
      return res.status(400).json({
        error: "Meeting date/time must be in the future",
      });
    }

    const roomId = `techtitans-${crypto.randomBytes(18).toString("hex")}`;

    const meeting = await Meeting.create({
      audience: meetingAudience,
      employeeId: meetingAudience === "INDIVIDUAL" ? employee._id : null,
      createdBy: req.session?.userId,
      title: title.trim(),
      type: type || "ONE_TO_ONE",
      scheduledAt: meetingDate,
      durationMinutes: Number(durationMinutes) || 30,
      roomId,
      status: "SCHEDULED",
      participants: [],
    });

    await logAudit(req, {
      action:
        meetingAudience === "ALL"
          ? "ALL_EMPLOYEE_MEETING_SCHEDULED"
          : "MEETING_SCHEDULED",
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel:
        meetingAudience === "ALL"
          ? `All Employees - ${meeting.title}`
          : `${employee.firstName} ${employee.lastName} - ${meeting.title}`,
      meta: {
        audience: meetingAudience,
        scheduledAt: meeting.scheduledAt,
        type: meeting.type,
      },
    });

    return res.status(201).json({
      success: true,
      data: serializeMeeting(meeting),
    });
  } catch (error) {
    console.error("Create meeting error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid data format provided",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to schedule meeting",
    });
  }
};

// PUT /api/meetings/:id
// ADMIN only
export const updateMeeting = async (req, res) => {
  try {
    if (req.session?.role !== "ADMIN") {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    if (["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(meeting.status)) {
      return res.status(400).json({
        error: "This meeting can no longer be edited",
      });
    }

    const { audience, employeeId, title, type, scheduledAt, durationMinutes } =
      req.body;

    if (!title || !scheduledAt) {
      return res.status(400).json({
        error: "Meeting title and date/time are required",
      });
    }

    const isAllMeeting = audience === "ALL" || employeeId === "ALL";
    const meetingAudience = isAllMeeting ? "ALL" : "INDIVIDUAL";

    let employee = null;

    if (meetingAudience === "INDIVIDUAL") {
      if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({
          error: "Please select a valid employee",
        });
      }

      employee = await Employee.findOne({
        _id: employeeId,
        isDeleted: { $ne: true },
        employmentStatus: "ACTIVE",
      });

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found",
        });
      }
    }

    const meetingDate = new Date(scheduledAt);

    if (Number.isNaN(meetingDate.getTime())) {
      return res.status(400).json({
        error: "Invalid meeting date",
      });
    }

    if (meetingDate.getTime() < Date.now()) {
      return res.status(400).json({
        error: "Meeting date/time must be in the future",
      });
    }

    meeting.audience = meetingAudience;
    meeting.employeeId = meetingAudience === "INDIVIDUAL" ? employee._id : null;
    meeting.title = title.trim();
    meeting.type = type || "ONE_TO_ONE";
    meeting.scheduledAt = meetingDate;
    meeting.durationMinutes = Number(durationMinutes) || 30;

    await meeting.save();

    await logAudit(req, {
      action: "MEETING_UPDATED",
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel: meeting.title,
      meta: {
        audience: meetingAudience,
        scheduledAt: meeting.scheduledAt,
        type: meeting.type,
      },
    });

    return res.json({
      success: true,
      data: serializeMeeting(meeting),
    });
  } catch (error) {
    console.error("Update meeting error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid data format provided",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to update meeting",
    });
  }
};

// DELETE /api/meetings/:id
// ADMIN only
export const deleteMeeting = async (req, res) => {
  try {
    if (req.session?.role !== "ADMIN") {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    if (["IN_PROGRESS", "COMPLETED"].includes(meeting.status)) {
      return res.status(400).json({
        error: "This meeting can no longer be deleted",
      });
    }

    await Meeting.deleteOne({ _id: meeting._id });

    await logAudit(req, {
      action: "MEETING_DELETED",
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel: meeting.title,
      meta: {
        audience: meeting.audience,
      },
    });

    return res.json({
      success: true,
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    console.error("Delete meeting error:", error);
    return res.status(500).json({
      error: "Failed to delete meeting",
    });
  }
};

// GET /api/meetings
export const getMeetings = async (req, res) => {
  try {
    const session = req.session;
    let where = {};

    if (session?.role !== "ADMIN") {
      const employee = await getEmployeeForUser(session?.userId);

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found",
        });
      }

      where = {
        $or: [
          { audience: "ALL" },
          { audience: "INDIVIDUAL", employeeId: employee._id },
          { audience: { $exists: false }, employeeId: employee._id },
        ],
      };
    }

    if (req.query.status) {
      where = {
        $and: [where, { status: req.query.status }],
      };
    }

    const meetings = await Meeting.find(where)
      .populate("employeeId", "firstName lastName email position department")
      .populate("createdBy", "email role")
      .populate(
        "participants.employeeId",
        "firstName lastName email position department",
      )
      .sort({ scheduledAt: -1 })
      .lean();

    const data = meetings.map((m) => ({
      ...m,
      id: m._id.toString(),
      audience: m.audience || "INDIVIDUAL",
      participantsCount: Array.isArray(m.participants)
        ? m.participants.length
        : 0,
      canStartNow: new Date(m.scheduledAt).getTime() <= Date.now(),
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get meetings error:", error);
    return res.status(500).json({
      error: "Failed to fetch meetings",
    });
  }
};

// GET /api/meetings/:id
export const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("employeeId", "firstName lastName email position department")
      .populate("createdBy", "email role")
      .populate(
        "participants.employeeId",
        "firstName lastName email position department",
      );

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    const allowed = await canAccessMeeting(req, meeting);

    if (!allowed) {
      return res.status(403).json({
        error: "You cannot access this meeting",
      });
    }

    return res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        id: meeting._id.toString(),
        participantsCount: Array.isArray(meeting.participants)
          ? meeting.participants.length
          : 0,
        canStartNow: new Date(meeting.scheduledAt).getTime() <= Date.now(),
      },
    });
  } catch (error) {
    console.error("Get meeting error:", error);
    return res.status(500).json({
      error: "Failed to fetch meeting",
    });
  }
};

// PATCH /api/meetings/:id/respond
export const respondToMeeting = async (req, res) => {
  try {
    if (req.session?.role === "ADMIN") {
      return res.status(403).json({
        error: "Employee response only",
      });
    }

    const { status } = req.body;

    if (!["ACCEPTED", "DECLINED"].includes(status)) {
      return res.status(400).json({
        error: "Invalid meeting response",
      });
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    if (!(await canAccessMeeting(req, meeting))) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    if (meeting.audience === "ALL") {
      return res.json({
        success: true,
        data: meeting,
        message: "No individual response required for company-wide meeting",
      });
    }

    meeting.status = status;
    await meeting.save();

    await logAudit(req, {
      action: `MEETING_${status}`,
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel: meeting.title,
    });

    return res.json({
      success: true,
      data: meeting,
    });
  } catch (error) {
    console.error("Respond to meeting error:", error);
    return res.status(500).json({
      error: "Failed to update meeting",
    });
  }
};

// PATCH /api/meetings/:id/start
export const startMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    if (!(await canAccessMeeting(req, meeting))) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    if (["COMPLETED", "CANCELLED"].includes(meeting.status)) {
      return res.status(400).json({
        error: "This meeting cannot be started",
      });
    }

    const scheduledTime = new Date(meeting.scheduledAt).getTime();
    const now = Date.now();

    if (now < scheduledTime) {
      return res.status(400).json({
        error: `This meeting can start only at ${new Date(
          meeting.scheduledAt,
        ).toLocaleString()}`,
      });
    }

    meeting.status = "IN_PROGRESS";

    if (!meeting.startedAt) {
      meeting.startedAt = new Date();
    }

    if (req.session?.role !== "ADMIN") {
      const employee = await getEmployeeForUser(req.session?.userId);

      if (employee) {
        await addOrUpdateParticipant(meeting, employee._id);
      }
    }

    await meeting.save();

    await logAudit(req, {
      action: "MEETING_JOINED",
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel: meeting.title,
      meta: {
        audience: meeting.audience,
      },
    });

    return res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        id: meeting._id.toString(),
        participantsCount: Array.isArray(meeting.participants)
          ? meeting.participants.length
          : 0,
      },
    });
  } catch (error) {
    console.error("Start meeting error:", error);
    return res.status(500).json({
      error: "Failed to start meeting",
    });
  }
};

// PUT /api/meetings/:id/notes
export const updateMeetingNotes = async (req, res) => {
  try {
    const { discussion, issues, managerComments, actionItems } = req.body;

    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      {
        notes: {
          discussion: discussion || "",
          issues: issues || "",
          managerComments: managerComments || "",
        },
        actionItems: Array.isArray(actionItems)
          ? actionItems
              .filter((item) => item?.text?.trim())
              .map((item) => ({
                text: item.text.trim(),
                completed: Boolean(item.completed),
                dueDate: item.dueDate || null,
              }))
          : [],
      },
      { new: true },
    )
      .populate("employeeId", "firstName lastName email position department")
      .populate(
        "participants.employeeId",
        "firstName lastName email position department",
      );

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    await logAudit(req, {
      action: "MEETING_NOTES_UPDATED",
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel: meeting.title,
    });

    return res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        id: meeting._id.toString(),
        participantsCount: Array.isArray(meeting.participants)
          ? meeting.participants.length
          : 0,
      },
    });
  } catch (error) {
    console.error("Update notes error:", error);
    return res.status(500).json({
      error: "Failed to save notes",
    });
  }
};

// PATCH /api/meetings/:id/end
export const endMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("employeeId", "firstName lastName email position department")
      .populate(
        "participants.employeeId",
        "firstName lastName email position department",
      );

    if (!meeting) {
      return res.status(404).json({
        error: "Meeting not found",
      });
    }

    if (req.session?.role !== "ADMIN") {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    const scheduledTime = new Date(meeting.scheduledAt).getTime();
    const now = Date.now();

    if (now < scheduledTime) {
      return res.status(400).json({
        error: "Meeting cannot be ended before the scheduled time",
      });
    }

    if (meeting.status !== "IN_PROGRESS") {
      return res.status(400).json({
        error: "Meeting must be in progress before it can be ended",
      });
    }

    meeting.status = "COMPLETED";
    meeting.endedAt = new Date();

    meeting.participants = (meeting.participants || []).map((participant) => ({
      ...(participant.toObject ? participant.toObject() : participant),
      leftAt: participant.leftAt || new Date(),
      lastSeenAt: participant.lastSeenAt || new Date(),
    }));

    await meeting.save();

    await logAudit(req, {
      action: "MEETING_COMPLETED",
      entityType: "Meeting",
      entityId: meeting._id,
      entityLabel: meeting.title,
      meta: {
        audience: meeting.audience,
      },
    });

    return res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        id: meeting._id.toString(),
        participantsCount: Array.isArray(meeting.participants)
          ? meeting.participants.length
          : 0,
      },
    });
  } catch (error) {
    console.error("End meeting error:", error);
    return res.status(500).json({
      error: "Failed to end meeting",
    });
  }
};
