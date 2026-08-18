import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell,
  RefreshCw,
  Users,
  CalendarCheck,
  FileText,
  AlertCircle,
  Download,
  Filter,
  Search,
  ChevronRight,
} from "lucide-react";
import api from "../api/axios";

const COLOMBO_TZ = "Asia/Colombo";

const monthLabel = (monthKey) => {
  if (!monthKey) return "-";
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(d);
};

const currency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `Rs. ${n.toLocaleString()}`;
};

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Number(n) || 0));

const tone = (pct) => {
  const p = Number(pct);
  if (!Number.isFinite(p))
    return { label: "-", bar: "bg-slate-200", text: "text-slate-500" };
  if (p >= 90)
    return {
      label: "Excellent",
      bar: "bg-emerald-500",
      text: "text-emerald-700",
    };
  if (p >= 80)
    return { label: "Good", bar: "bg-indigo-500", text: "text-indigo-700" };
  if (p >= 70)
    return {
      label: "Needs Attention",
      bar: "bg-amber-500",
      text: "text-amber-700",
    };
  return { label: "Critical", bar: "bg-rose-500", text: "text-rose-700" };
};

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);

const StatCard = ({ title, value, sub, Icon, loading, emptyHint, to }) => {
  const inner = (
    <div className="card p-6 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-indigo-500/60" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          {loading ? (
            <Skeleton className="h-9 w-24 mt-2" />
          ) : value == null ? (
            <p className="text-lg font-semibold text-slate-600 mt-2">
              {emptyHint || "-"}
            </p>
          ) : (
            <p className="text-3xl font-semibold text-slate-900 mt-2">
              {value}
            </p>
          )}
          {loading ? (
            <Skeleton className="h-4 w-40 mt-3" />
          ) : sub ? (
            <p className="text-sm text-slate-500 mt-3">{sub}</p>
          ) : null}
        </div>
        <div className="p-3 bg-slate-100 rounded-xl shrink-0">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
};

const Donut = ({ percent }) => {
  const p = clamp(percent);
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      <circle
        cx="48"
        cy="48"
        r={r}
        stroke="#e2e8f0"
        strokeWidth="10"
        fill="none"
      />
      <circle
        cx="48"
        cy="48"
        r={r}
        stroke="#4f46e5"
        strokeWidth="10"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text
        x="48"
        y="53"
        textAnchor="middle"
        fontSize="16"
        fill="#0f172a"
        fontWeight="700"
      >
        {p}%
      </text>
    </svg>
  );
};

const LineChart = ({ days }) => {
  const points = (days || []).map((d, idx) => ({
    x: idx,
    y: d.attendancePercent == null ? null : clamp(d.attendancePercent),
    ...d,
  }));

  const hasAny = points.some((p) => p.y != null);
  if (!hasAny) {
    return (
      <div className="text-slate-400 text-sm">
        No attendance records available for last 7 days.
      </div>
    );
  }

  const W = 520,
    H = 160,
    padX = 24,
    padY = 18;
  const maxX = Math.max(1, points.length - 1);

  const scaleX = (x) => padX + (x / maxX) * (W - padX * 2);
  const scaleY = (y) => padY + ((100 - y) / 100) * (H - padY * 2);

  let dPath = "";
  let started = false;
  for (const p of points) {
    if (p.y == null) {
      started = false;
      continue;
    }
    const x = scaleX(p.x);
    const y = scaleY(p.y);
    if (!started) {
      dPath += `M ${x} ${y}`;
      started = true;
    } else {
      dPath += ` L ${x} ${y}`;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]">
      <line
        x1={padX}
        y1={scaleY(0)}
        x2={W - padX}
        y2={scaleY(0)}
        stroke="#e2e8f0"
      />
      <line
        x1={padX}
        y1={scaleY(50)}
        x2={W - padX}
        y2={scaleY(50)}
        stroke="#f1f5f9"
      />
      <line
        x1={padX}
        y1={scaleY(100)}
        x2={W - padX}
        y2={scaleY(100)}
        stroke="#f1f5f9"
      />

      <path
        d={dPath}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {points.map((p) => {
        const x = scaleX(p.x);
        const y = p.y == null ? null : scaleY(p.y);
        return (
          <g key={p.dateKey}>
            {y == null ? (
              <circle cx={x} cy={scaleY(0)} r="3" fill="#cbd5e1" />
            ) : (
              <circle cx={x} cy={y} r="4" fill="#4f46e5">
                <title>
                  {`${p.day} (${p.dateKey})
Present: ${p.present}
Late: ${p.late}
Absent: ${p.absent ?? "-"}
Leave: ${p.leave}
Attendance: ${p.attendancePercent}%`}
                </title>
              </circle>
            )}
            <text
              x={x}
              y={H - 4}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {p.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default function AdminDashboard() {
  const [monthKey, setMonthKey] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  const [dept, setDept] = useState("ALL");
  const [search, setSearch] = useState("");

  const fetchSummary = async (opts = { soft: false }) => {
    try {
      opts.soft ? setRefreshing(true) : setLoading(true);
      const res = await api.get(`/admin-dashboard/summary?month=${monthKey}`);
      setData(res.data);
    } catch (e) {
      toast.error(
        e?.response?.data?.error || e?.message || "Failed to load dashboard",
      );
      setData(null);
    } finally {
      opts.soft ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const notificationsCount = data?.notifications?.count || 0;
  const departments = data?.monthlyAttendance?.departments || ["ALL"];

  const monthlyRows = useMemo(() => {
    const rows = Array.isArray(data?.monthlyAttendance?.rows)
      ? data.monthlyAttendance.rows
      : [];
    const filtered = rows.filter((r) =>
      dept === "ALL" ? true : r.department === dept,
    );
    const q = search.trim().toLowerCase();
    return q
      ? filtered.filter((r) =>
          `${r.name} ${r.employeeCode} ${r.department}`
            .toLowerCase()
            .includes(q),
        )
      : filtered;
  }, [data, dept, search]);

  const exportCSV = () => {
    const headers = [
      "Employee",
      "Employee ID",
      "Department",
      "Working Days",
      "Present",
      "Absent",
      "Leave",
      "Late",
      "Attendance %",
    ];
    const lines = [headers.join(",")];

    for (const r of monthlyRows) {
      lines.push(
        [
          `"${String(r.name).replaceAll('"', '""')}"`,
          `"${String(r.employeeCode).replaceAll('"', '""')}"`,
          `"${String(r.department).replaceAll('"', '""')}"`,
          r.workingDays ?? 0,
          r.present ?? 0,
          r.absent ?? 0,
          r.leave ?? 0,
          r.late ?? 0,
          r.attendancePercent ?? "",
        ].join(","),
      );
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-attendance-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const employees = data?.employees;
  const today = data?.today;
  const leaves = data?.leaves;
  const payroll = data?.payroll;
  const weekly = data?.weekly;
  const deptAtt = data?.departmentAttendance || [];
  const alerts = data?.alerts || [];
  const pendingActions = data?.pendingActions;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Admin Dashboard
          </h1>
          <p className="text-slate-500 mt-2">
            Monitor your workforce, attendance, leave and payroll from one
            place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 relative"
          >
            <Bell className="w-4 h-4" />
            Notifications
            {notificationsCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-semibold rounded-full bg-indigo-600 text-white">
                {notificationsCount}
              </span>
            )}
          </button>

          <div className="card px-3 py-2 inline-flex items-center gap-3">
            <span className="text-sm text-slate-700">
              {monthLabel(monthKey)}
            </span>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchSummary({ soft: true })}
            className="btn-secondary inline-flex items-center gap-2"
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total Employees"
          value={loading ? null : employees?.total}
          sub={
            loading
              ? null
              : employees
                ? `${employees.active} Active · ${employees.inactive} Inactive · +${employees.joinedThisMonth} this month`
                : null
          }
          Icon={Users}
          loading={loading}
          emptyHint="No employees"
          to="/employees"
        />

        <StatCard
          title="Present Today"
          value={loading ? null : today?.present}
          sub={
            loading
              ? null
              : today?.hasAttendanceRecorded
                ? `${today.attendancePercent ?? 0}% of active employees`
                : "No attendance recorded today"
          }
          Icon={CalendarCheck}
          loading={loading}
          emptyHint="No attendance"
          to="/attendance"
        />

        <StatCard
          title="On Leave Today"
          value={loading ? null : (today?.leaveApproved ?? null)}
          sub={
            loading
              ? null
              : `Approved ${today?.leaveApproved ?? 0} · Pending ${today?.leavePending ?? 0}`
          }
          Icon={FileText}
          loading={loading}
          emptyHint="No leave"
          to="/leave"
        />

        <StatCard
          title="Pending Actions"
          value={loading ? null : pendingActions?.total}
          sub={
            loading
              ? null
              : `${pendingActions?.leaves ?? 0} Leave Requests · ${pendingActions?.payslips ?? 0} Payslips Pending`
          }
          Icon={AlertCircle}
          loading={loading}
          emptyHint="All caught up"
        />
      </div>

      {/* Today Attendance + Weekly Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Today's Attendance
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Summary based on recorded attendance
              </p>
            </div>

            {loading ? (
              <Skeleton className="w-24 h-24 rounded-full" />
            ) : today?.hasAttendanceRecorded &&
              today?.attendancePercent != null ? (
              <Donut percent={today.attendancePercent} />
            ) : (
              <div className="text-sm text-slate-500">
                No attendance recorded today
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Present</span>
              <span className="font-semibold text-slate-900">
                {today?.present ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Late</span>
              <span className="font-semibold text-slate-900">
                {today?.late ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Absent</span>
              <span className="font-semibold text-slate-900">
                {today?.absent ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">On Leave</span>
              <span className="font-semibold text-slate-900">
                {today?.leaveApproved ?? 0}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <Link
              to="/attendance"
              className="text-sm text-indigo-600 hover:underline"
            >
              View Attendance →
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Weekly Attendance Trend
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Last 7 days attendance percentage
          </p>

          <div className="mt-5">
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : weekly?.hasAnyData ? (
              <LineChart days={weekly.days || []} />
            ) : (
              <div className="text-slate-400 text-sm">
                No attendance records available for last 7 days.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Attendance */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Monthly Attendance
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Employee attendance performance for {monthLabel(monthKey)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="card px-3 py-2 inline-flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  className="text-sm outline-none bg-transparent"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                >
                  {(departments || ["ALL"]).map((d) => (
                    <option key={d} value={d}>
                      {d === "ALL" ? "All Departments" : d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="card px-3 py-2 inline-flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  className="text-sm outline-none w-56 bg-transparent"
                  placeholder="Search employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                onClick={exportCSV}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full mt-3" />
              <Skeleton className="h-10 w-full mt-3" />
            </div>
          ) : !data?.monthlyAttendance?.hasAnyData ? (
            <div className="p-10 text-center text-slate-400">
              No attendance records available for {monthLabel(monthKey)}.
            </div>
          ) : monthlyRows.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              No employees match your filters.
            </div>
          ) : (
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="text-left text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-6 py-4 font-semibold">EMPLOYEE</th>
                  <th className="px-6 py-4 font-semibold">DEPARTMENT</th>
                  <th className="px-6 py-4 font-semibold text-right">
                    WORKING DAYS
                  </th>
                  <th className="px-6 py-4 font-semibold text-right">
                    PRESENT
                  </th>
                  <th className="px-6 py-4 font-semibold text-right">ABSENT</th>
                  <th className="px-6 py-4 font-semibold text-right">LEAVE</th>
                  <th className="px-6 py-4 font-semibold text-right">LATE</th>
                  <th className="px-6 py-4 font-semibold text-right">
                    ATTENDANCE
                  </th>
                  <th className="px-6 py-4 font-semibold text-right">OPEN</th>
                </tr>
              </thead>

              <tbody>
                {monthlyRows.map((r) => {
                  const t = tone(r.attendancePercent);
                  return (
                    <tr
                      key={r.employeeId}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-5">
                        <div className="font-medium text-slate-900">
                          {r.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          ID: {r.employeeCode} · {r.jobTitle}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-600">
                        {r.department}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {r.workingDays ?? 0}
                      </td>
                      <td className="px-6 py-5 text-right">{r.present ?? 0}</td>
                      <td className="px-6 py-5 text-right">{r.absent ?? 0}</td>
                      <td className="px-6 py-5 text-right">{r.leave ?? 0}</td>
                      <td className="px-6 py-5 text-right">{r.late ?? 0}</td>
                      <td className="px-6 py-5 text-right">
                        {r.attendancePercent == null ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <div className={`text-sm font-semibold ${t.text}`}>
                              {r.attendancePercent}%
                            </div>
                            <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-2 ${t.bar}`}
                                style={{
                                  width: `${clamp(r.attendancePercent)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-24 text-left">
                              {t.label}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Link
                          to={`/reports/employee/${r.employeeId}`}
                          className="inline-flex items-center gap-2 text-indigo-600 text-sm"
                        >
                          View <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Attendance by Department + Leave Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Attendance by Department
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Average attendance for {monthLabel(monthKey)}
          </p>

          <div className="mt-5 space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : deptAtt.length === 0 ? (
              <div className="text-slate-400 text-sm">
                No department attendance data available.
              </div>
            ) : (
              deptAtt.map((d) => (
                <div key={d.department} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-slate-700 truncate">
                    {d.department}
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-indigo-500"
                      style={{ width: `${clamp(d.attendancePercent ?? 0)}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm font-semibold text-slate-900">
                    {d.attendancePercent == null
                      ? "-"
                      : `${d.attendancePercent}%`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Leave Overview
          </h2>
          <p className="text-sm text-slate-500 mt-1">{monthLabel(monthKey)}</p>

          {loading ? (
            <div className="mt-5 space-y-3">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-6 w-48" />
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Pending</p>
                  <p className="text-xl font-semibold mt-1">
                    {leaves?.month?.pending ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Approved</p>
                  <p className="text-xl font-semibold mt-1">
                    {leaves?.month?.approved ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Rejected</p>
                  <p className="text-xl font-semibold mt-1">
                    {leaves?.month?.rejected ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  to="/leave"
                  className="text-sm text-indigo-600 hover:underline"
                >
                  View Leave Requests →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Requires Attention + Payroll */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Requires Attention
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Issues detected from real data
          </p>

          <div className="mt-5 space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : alerts.length === 0 ? (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
                Everything looks good. No attendance or leave issues require
                attention.
              </div>
            ) : (
              alerts.slice(0, 6).map((a, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200"
                >
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                  {a.to ? (
                    <Link
                      to={a.to}
                      className="text-sm text-indigo-600 hover:underline mt-2 inline-block"
                    >
                      View →
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Payroll — {monthLabel(monthKey)}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Based on generated payslips
          </p>

          <div className="mt-5">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : payroll?.hasData ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Payroll</p>
                  <p className="text-xl font-semibold mt-1">
                    {currency(payroll.total)}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Payslips Generated</p>
                  <p className="text-xl font-semibold mt-1">
                    {payroll.payslipsGenerated}
                  </p>
                </div>

                <div className="col-span-2 mt-2">
                  <Link
                    to="/payslips"
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    View Payslips →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 text-slate-600">
                No payroll data available for {monthLabel(monthKey)}.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        <p className="text-sm text-slate-500 mt-1">Common admin tasks</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/employees" className="btn-primary">
            + Add / Manage Employees
          </Link>
          <Link to="/leave" className="btn-secondary">
            ✓ Approve Leaves
          </Link>
          <Link to="/payslips" className="btn-secondary">
            $ Payslips
          </Link>
          <Link to="/meetings" className="btn-secondary">
            ▣ Meetings
          </Link>
        </div>
      </div>
    </div>
  );
}
