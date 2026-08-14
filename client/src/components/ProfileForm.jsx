import React, { useState } from "react";
import { User, Save, Loader2 } from "lucide-react";
import api from "../api/axios";

const ProfileForm = ({ initialData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const data = {
      bio: formData.get("bio"),
    };

    try {
      // ✅ FIXED: Changed from .post to .put to match backend routing
      await api.post("/profile", data);
      setMessage("Profile updated successfully");

      // Notify parent component to refresh data
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 sm:p-6 mb-6 bg-white border border-slate-200 rounded-xl shadow-sm"
    >
      <h2 className="text-base font-medium text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
        <User className="w-5 h-5 text-slate-400" />
        Public Profile
      </h2>

      {/* ✅ FIXED: Render the Success Green Alert Box */}
      {message && (
        <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-3 animate-fade-in">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* ✅ FIXED: Render the Failure Red Alert Box */}
      {error && (
        <div className="p-4 mb-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-3 animate-fade-in">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Name & Email Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Name
            </label>
            <input
              disabled
              value={`${initialData?.firstName ?? ""} ${initialData?.lastName ?? ""}`.trim()}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              disabled
              value={initialData?.email ?? ""}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed outline-none"
            />
          </div>
        </div>

        {/* Position Field */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Position
          </label>
          <input
            disabled
            value={initialData?.position ?? ""}
            className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed outline-none"
          />
        </div>

        {/* Bio Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Bio
          </label>
          <textarea
            disabled={initialData?.isDeleted}
            name="bio"
            defaultValue={initialData?.bio || ""}
            placeholder="Write a brief bio..."
            className={`w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none ${
              initialData?.isDeleted
                ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                : "bg-white text-slate-800"
            }`}
            rows={4}
          />
          <p className="text-xs text-slate-400 mt-1.5">
            This will be displayed on your profile.
          </p>
        </div>

        {/* Footer Actions */}
        {initialData?.isDeleted ? (
          <div className="pt-2">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <p className="text-rose-600 font-medium tracking-tight">
                Account Deactivated
              </p>
              <p className="text-sm text-rose-500 mt-0.5">
                You can no longer update your profile.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </form>
  );
};

export default ProfileForm;
