import React, { useEffect, useState } from "react";
import { User, Save, Loader2 } from "lucide-react";

const ProfileForm = ({ initialData, onSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    bio: "",
  });

  const [loading, setLoading] = useState(false);

  // IMPORTANT: update form when initialData changes (after fetch)
  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        email: initialData.email || "",
        position: initialData.position || "",
        bio: initialData.bio || "",
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: replace with your API call
      console.log("Profile data:", formData);

      setTimeout(() => {
        setLoading(false);
        onSuccess?.(formData);
      }, 800);
    } catch (err) {
      console.error("Failed to update profile:", err);
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

      <div className="space-y-5">
        {/* Name */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-medium
      text-slate-400 mb-2"
              >
                Name
              </label>
              <input
                disabled
                value={`${initialData?.firstName ?? ""} ${initialData?.lastName ?? ""}`.trim()}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
              />
            </div>
            {/* Email */}
            <div>
              <label
                className="block text-sm font-medium
  text-slate-700 mb-2"
              >
                Email
              </label>
              <input
                disabled
                value={initialData.email}
                className="bg-slate-50 text-slate-400
  cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Position */}
        <div className="sm:col-span-2">
          <label
            className="block text-sm font-medium
  text-slate-700 mb-2"
          >
            Position
          </label>
          <input
            disabled
            value={initialData.position}
            className="bg-slate-50 text-slate-400
  cursor-not-allowed"
          />
        </div>

        {/* Bio */}
        <div>
          <label
            className="block text-sm font-medium text-slate-700
  mb-2"
          >
            Bio
          </label>
          <textarea
            disabled={initialData.isDeleted}
            name="bio"
            defaultValue={initialData.bio || ""}
            placeholder="Write a brief bio..."
            className={`resize-none ${
              initialData.isDeleted
                ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                : ""
            }`}
          />
          <p className="text-xs text-slate-400 mt-1.5">
            This will be displayed on your profile.
          </p>
        </div>
        {initialData.isDeleted ? (
          <div className="pt-2">
            <div
              className="p-4 bg-rose-50 border border-rose-200
    rounded-xl text-center"
            >
              <p
                className="text-rose-600 font-medium
      tracking-tight"
              >
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
              className="btn-primary flex items-center gap-2 justify-center
  w-full sm:w-auto"
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
