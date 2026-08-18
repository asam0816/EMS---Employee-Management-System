import React from "react";
import { Navigate } from "react-router-dom";
import LoginLeftSide from "../components/LoginLeftSide";
import LoginForm from "../components/LoginForm";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";

const LoginLanding = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  // ✅ if already logged in (admin or employee) go dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-screen">
      <LoginLeftSide />

      <div className="w-full md:w-1/2 flex items-center justify-center bg-white">
        <div className="w-full max-w-md p-6">
          <h2 className="text-3xl font-medium text-slate-900 tracking-tight mb-3">
            Welcome Back
          </h2>
          <p className="text-slate-500 mb-8">Sign in with your account.</p>

          <LoginForm />

          <div className="mt-12 text-center md:text-left text-sm text-slate-400">
            <p>© {new Date().getFullYear()} TechTitans. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginLanding;
