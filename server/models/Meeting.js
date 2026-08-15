import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  { _id: true },
);

const participantSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const meetingSchema = new mongoose.Schema(
  {
    audience: {
      type: String,
      enum: ["INDIVIDUAL", "ALL"],
      default: "INDIVIDUAL",
      required: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["PERFORMANCE", "PROJECT", "HR_DISCUSSION", "ONE_TO_ONE", "OTHER"],
      default: "ONE_TO_ONE",
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    durationMinutes: {
      type: Number,
      default: 30,
      min: 5,
    },

    roomId: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: [
        "SCHEDULED",
        "ACCEPTED",
        "DECLINED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "SCHEDULED",
    },

    notes: {
      discussion: {
        type: String,
        default: "",
      },
      issues: {
        type: String,
        default: "",
      },
      managerComments: {
        type: String,
        default: "",
      },
    },

    actionItems: {
      type: [actionItemSchema],
      default: [],
    },

    participants: {
      type: [participantSchema],
      default: [],
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Clean validation hook - no next()
meetingSchema.pre("validate", function () {
  if (this.audience === "INDIVIDUAL" && !this.employeeId) {
    throw new Error("Employee is required for an individual meeting");
  }

  if (this.audience === "ALL") {
    this.employeeId = null;
  }
});

const Meeting =
  mongoose.models.Meeting || mongoose.model("Meeting", meetingSchema);

export default Meeting;
