import React from "react";
import { Users, Building2, Calendar, FileText } from "lucide-react"; // 1. you only imported UsersIcon but use 4 icons

const AdminDashboard = ({ data }) => {
  const stats = [
    {
      icon: Users,
      value: data.totalEmployees,
      label: "Total Employees",
    },
    {
      icon: Building2,
      value: data.totalDepartments,
      label: "Departments",
    },
    {
      icon: Calendar,
      value: data.todayAttendance,
      label: "Today's Attendance",
    },
    {
      icon: FileText,
      value: data.pendingLeaves,
      label: "Pending Leaves",
    },
  ];

  return (
    // 2. you wrote `return;` <- ; kills return, nothing renders = blank
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome Back, Admin - Here you can monitor employee statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        {stats.map((s) => {
          const Icon = s.icon; // 3. you wrote card.icon, but your variable is `s`
          return (
            <div
              key={s.label}
              className="card card-hover p-5 sm:p-6 relative overflow-hidden group flex items-center justify-between"
            >
              <div>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-500/70 group-hover:bg-indigo-500/70" />
                <p className="text-sm font-medium text-slate-700">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {s.value}
                </p>
              </div>
              <Icon className="size-10 p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600" />
            </div>
          );
        })}
      </div>
    </div>
  ); // 4. you never closed return(
};

export default AdminDashboard;
