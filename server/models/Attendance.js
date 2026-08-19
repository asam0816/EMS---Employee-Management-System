import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // Work date key (shift base day) YYYY-MM-DD
    attendanceDateKey: { type: String, required: true, index: true },

    shiftKey: {
      type: String,
      enum: ["DAY", "NIGHT"],
      required: true,
      index: true,
    },

    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },

    scheduledEndAt: { type: Date, default: null, index: true },

    attendanceState: {
      type: String,
      enum: ["WORKING", "COMPLETED", "AUTO_CLOCKED_OUT"],
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["PRESENT", "LATE", "ABSENT"],
      default: "PRESENT",
      index: true,
    },

    lateMinutes: { type: Number, default: 0 },

    totalWorkingMinutes: { type: Number, default: null },
    workingMinutes: { type: Number, default: null },
    workingHours: { type: Number, default: null },

    dayType: {
      type: String,
      enum: ["Full Day", "Three Quarter Day", "Half Day", "Short Day", null],
      default: null,
    },
  },
  { timestamps: true },
);

// ✅ IMPORTANT: only one attendance per employee per work date (per day)
attendanceSchema.index(
  { employeeId: 1, attendanceDateKey: 1 },
  { unique: true },
);

const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;
