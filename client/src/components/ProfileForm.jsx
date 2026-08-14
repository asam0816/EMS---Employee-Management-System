import { useEffect, useState } from "react";
import { User, Save, Loader2, Upload } from "lucide-react";
import api from "../api/axios";

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const ProfileForm = ({ initialData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [bio, setBio] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    setBio(initialData?.bio || "");
    setImage(initialData?.image || null);
    setPreview(initialData?.image || null);
  }, [initialData]);

  const disabled = initialData?.isDeleted;

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image too large (max 2MB).");
      return;
    }

    const base64 = await fileToBase64(file);
    setImage(base64);
    setPreview(base64);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // ✅ Only updating allowed fields: bio + image
      await api.put("/profile", { bio, image });
      setMessage("Profile updated successfully");
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const readOnlyClass =
    "w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed";

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 sm:p-6 mb-6 bg-white border border-slate-200 rounded-xl shadow-sm"
    >
      <h2 className="text-base font-medium text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
        <User className="w-5 h-5 text-slate-400" />
        Public Profile
      </h2>

      {/* Alerts */}
      {message && (
        <div className="p-4 mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 mb-5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Profile Picture */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
            {preview ? (
              <img
                src={preview}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-slate-500 font-semibold">
                {(initialData?.firstName?.[0] || "U").toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">
              Profile picture
            </p>
            <p className="text-xs text-slate-500 mt-0.5">JPG/PNG, max 2MB</p>

            <label
              className={`inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm ${
                disabled
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white hover:bg-slate-50 cursor-pointer"
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
              <input
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                disabled={disabled}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Name
            </label>
            <input
              disabled
              value={`${initialData?.firstName ?? ""} ${
                initialData?.lastName ?? ""
              }`.trim()}
              className={readOnlyClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              disabled
              value={initialData?.email || ""}
              className={readOnlyClass}
            />
          </div>
        </div>

        {/* ✅ NIC (Read only) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            National ID Number
          </label>
          <input
            disabled
            value={initialData?.nationalIdNumber || "—"}
            className={readOnlyClass}
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Position
          </label>
          <input
            disabled
            value={initialData?.position || ""}
            className={readOnlyClass}
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Bio
          </label>
          <textarea
            disabled={disabled}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Write a brief bio..."
            className={`w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none ${
              disabled
                ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                : "bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            }`}
          />
          <p className="text-xs text-slate-400 mt-1.5">
            This will be displayed on your profile.
          </p>
        </div>

        {/* Save Button */}
        {disabled ? (
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
              className="btn-primary flex items-center gap-2 justify-center w-full sm:w-auto"
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
