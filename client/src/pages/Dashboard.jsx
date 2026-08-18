import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";
import EmployeeDashboard from "../components/EmployeeDashboard";
import AdminDashboard from "../components/AdminDashboard";

const Dashboard = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  // Admin dashboard (fetches its own data internally)
  if (user?.role === "ADMIN") {
    return <AdminDashboard />;
  }

  // Employee dashboard
  return <EmployeeDashboard />;
};

export default Dashboard;
