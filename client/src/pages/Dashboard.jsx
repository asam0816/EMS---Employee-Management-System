import { useEffect, useState } from "react";
import {
  dummyAdminDashboardData,
  dummyEmployeeDashboardData,
} from "../assets/assets";
import Loading from "../components/Loading";
import EmployeeDashboard from "../components/EmployeeDashboard";
import AdminDashboard from "../components/AdminDashboard"; // 1. MISSING

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(dummyAdminDashboardData); // 2. you imported dummyEmployee... but use dummyAdmin...
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <Loading />;

  if (!data)
    return (
      <p className="text-center text-slate-500 py-12">
        Failed to load dashboard
      </p>
    );

  if (data.role === "ADMIN") {
    return <AdminDashboard data={data} />; // 3. you returned <div>admin dashboard</div> instead of component
  } else {
    return <EmployeeDashboard data={data} />;
  }
};

export default Dashboard;
