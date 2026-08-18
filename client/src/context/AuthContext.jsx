import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    const storedToken = localStorage.getItem("token");

    if (!storedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get("/auth/session");
      setUser(data.user);
      setToken(storedToken);
    } catch (error) {
      localStorage.removeItem("token");
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  // ✅ ONE login (no role_type)
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);

    return data.user;
  };

  // ✅ logout calls backend first (auto clock-out), then clears token
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error(
        "Logout API error:",
        error?.response?.data || error?.message,
      );
    } finally {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  };

  const value = { user, token, loading, login, logout, refreshSession };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
