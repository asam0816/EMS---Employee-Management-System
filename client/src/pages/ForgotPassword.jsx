import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success("If the email exists, a reset link has been sent.");
      setEmail("");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Forgot Password
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your account email to receive a reset link.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
            type="submit"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Reset Link
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

export default ForgotPassword;
