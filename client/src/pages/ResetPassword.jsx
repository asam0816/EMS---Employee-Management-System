import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword });
      toast.success("Password reset successfully. Please login.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-slate-900">Reset Password</h1>
        <p className="text-sm text-slate-500 mt-1">Enter a new password.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                required
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="New password"
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
            type="submit"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-600">
          <Link className="text-indigo-600 hover:underline" to="/login">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
