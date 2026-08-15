import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    date: { type: Date, default: null },

    attendanceDateKey: { type: String, default: null, index: true },

    // ✅ allow 2 shifts per dayKey
    shiftKey: {
      type: String,
      enum: ["DAY", "NIGHT", null],
      default: null,
      index: true,
    },

    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },

    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE"],
      default: "PRESENT",
    },

    workingHours: { type: Number, default: null },

    dayType: {
      type: String,
      enum: ["Full Day", "Three Quarter Day", "Half Day", "Short Day", null],
      default: null,
    },
  },
  { timestamps: true },
);

// ✅ unique per employee + dateKey + shiftKey
attendanceSchema.index(
  { employeeId: 1, attendanceDateKey: 1, shiftKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      attendanceDateKey: { $type: "string" },
      shiftKey: { $type: "string" },
    },
  },
);

const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;
