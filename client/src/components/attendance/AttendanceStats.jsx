import { AlertCircleIcon, CalendarIcon, ClockIcon } from "lucide-react";
import React, { useMemo } from "react";

const AttendanceStats = ({ history }) => {
  const { totalPresent, lateCount, avgWorkHrs } = useMemo(() => {
    const rows = history || [];

    // ✅ Count every attendance record with status PRESENT or LATE (matches your 4 rows)
    const presentRows = rows.filter(
      (r) => r?.status === "PRESENT" || r?.status === "LATE",
    );

    const lateRows = rows.filter((r) => r?.status === "LATE");

    // Calculate average working hours from records that have workingHours
    const validHoursRows = rows.filter(
      (r) => typeof r?.workingHours === "number",
    );
    const totalHours = validHoursRows.reduce(
      (sum, r) => sum + r.workingHours,
      0,
    );
    const avg =
      validHoursRows.length > 0
        ? Number((totalHours / validHoursRows.length).toFixed(2))
        : 0;

    return {
      totalPresent: presentRows.length,
      lateCount: lateRows.length,
      avgWorkHrs: avg,
    };
  }, [history]);

  const stats = [
    { label: "Days Present", value: totalPresent, icon: CalendarIcon },
    { label: "Late Arrivals", value: lateCount, icon: AlertCircleIcon },
    { label: "Avg. Work Hrs", value: `${avgWorkHrs} Hrs`, icon: ClockIcon },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="card card-hover p-5 sm:p-6 flex items-center gap-4 relative overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-500/70 group-hover:bg-indigo-500/70" />
          <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors duration-200">
            <s.icon className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 transition-colors duration-200" />
          </div>
          <div>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="text-2xl font-medium text-slate-900 tracking-tight">
              {s.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceStats;
