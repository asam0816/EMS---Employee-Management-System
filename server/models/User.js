import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "EMPLOYEE"], default: "EMPLOYEE" },
    // ✅ NEW: profile image for all users (admin + employee)
    image: { type: String, default: null }, // base64 data url
    // ✅ Forgot password fields
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
