import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [token, setToken] = useState(localStorage.getItem("token"));

  const [loading, setLoading] = useState(true);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem("token");

    setToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
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
    } catch {
      clearLocalSession();
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);

  // Listen for backend suspension response
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,

      (error) => {
        const code = error?.response?.data?.code;

        const requestUrl = error?.config?.url || "";

        // LoginForm already shows
        // the login error itself
        if (
          code === "ACCOUNT_SUSPENDED" &&
          !requestUrl.includes("/auth/login")
        ) {
          clearLocalSession();

          toast.error("Your account is not active");
        }

        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [clearLocalSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", {
      email,
      password,
    });

    localStorage.setItem("token", data.token);

    setToken(data.token);
    setUser(data.user);

    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error(
        "Logout API error:",
        error?.response?.data || error?.message,
      );
    } finally {
      clearLocalSession();
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
