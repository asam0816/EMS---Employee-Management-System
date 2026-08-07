import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { dummyProfileData } from "../assets/assets";
import {
  Menu,
  X,
  User,
  LayoutGrid,
  Calendar,
  FileText,
  DollarSign,
  Settings,
  ChevronRight,
  LogOut,           // ← Add this
} from "lucide-react";

const Sidebar = () => {
  const { pathname } = useLocation();
  const [userName, setUserName] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (dummyProfileData) {
      setUserName(dummyProfileData.firstName + " " + dummyProfileData.lastName);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const role = "EMPLOYEE"; // change to "ADMIN" if needed

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    role === "ADMIN"
      ? { name: "Employees", href: "/employees", icon: User }
      : { name: "Attendance", href: "/attendance", icon: Calendar },
    { name: "Leave", href: "/leave", icon: FileText },
    { name: "Payslips", href: "/payslips", icon: DollarSign },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const handleLogout = () => {
    window.location.href = "/login";
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="text-white size-7" />
            <div>
              <p className="font-semibold text-[13px] text-white">
                Employee MS
              </p>
              <p className="text-[11px] text-slate-500">Management System</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Profile Card */}
        {userName && (
          <div className="mx-3 mt-4 mb-1 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ring-1 ring-white/10 shrink-0">
                <span className="text-slate-400 text-xs font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-200 truncate">
                  {userName}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {role === "ADMIN" ? "Administrator" : "Employee"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Navigation
        </p>
      </div>

      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all relative ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-500" />
              )}
              <Icon
                className={`w-[18px] h-[18px] ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"}`}
              />
              <span>{item.name}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-indigo-500/60" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-white/6">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-[13px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/8 transition-all duration-150">
          <LogOut className="w-[17px] h-[17px]" />
          <span>Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg border border-white/10"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col h-full w-64 bg-gradient-to-b from-slate-900 to-slate-950 text-white shrink-0 border-r border-white/10">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-72 bg-slate-900 text-white z-50 flex flex-col transform transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </aside>
    </div>
  );
};

export default Sidebar;
