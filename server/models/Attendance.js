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

    // already exists in your schema
    workingHours: { type: Number, default: null },

    // ✅ add this (for exact "3h 3m" display)
    workingMinutes: { type: Number, default: null },

    dayType: {
      type: String,
      enum: ["Full Day", "Three Quarter Day", "Half Day", "Short Day", null],
      default: null,
    },
  },
  { timestamps: true },
);

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
