import React, { useMemo } from "react";

const MiniStat = ({ label, value }) => (
  <div className="p-4 rounded-xl border border-slate-200 bg-white">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
  </div>
);

const BadgeRow = ({ title, obj }) => {
  const entries = Object.entries(obj || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-600 mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className="px-2.5 py-1 rounded-full text-xs border border-slate-200 bg-slate-50 text-slate-700"
          >
            {k}: {v}
          </span>
        ))}
      </div>
    </div>
  );
};

const SummaryCards = ({ summary }) => {
  const attendance = summary?.attendance || {};
  const leaves = summary?.leaves || {};

  const daysPresent = useMemo(() => {
    const present = attendance?.statusCounts?.PRESENT || 0;
    const late = attendance?.statusCounts?.LATE || 0;
    return present + late;
  }, [attendance]);

  const lateCount = attendance?.statusCounts?.LATE || 0;
  const avgHours = attendance?.avgHours ?? 0;
  const totalHours = attendance?.totalHours ?? 0;

  const fullDays = attendance?.dayTypeCounts?.["Full Day"] || 0;
  const halfDays = attendance?.dayTypeCounts?.["Half Day"] || 0;

  const leaveApproved = leaves?.statusCounts?.APPROVED || 0;
  const leavePending = leaves?.statusCounts?.PENDING || 0;
  const approvedDays = leaves?.approvedDays ?? 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          Attendance Summary
        </h3>
        <p className="text-sm text-slate-500 mt-1">Last 30 days</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <MiniStat label="Days Present" value={daysPresent} />
          <MiniStat label="Late" value={lateCount} />
          <MiniStat label="Avg Work Hours" value={`${avgHours} hrs`} />

          <MiniStat label="Full Days" value={fullDays} />
          <MiniStat label="Half Days" value={halfDays} />
          <MiniStat label="Total Hours" value={`${totalHours} hrs`} />
        </div>

        <BadgeRow title="By Status" obj={attendance?.statusCounts} />
        <BadgeRow title="By Day Type" obj={attendance?.dayTypeCounts} />
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900">Leave Summary</h3>
        <p className="text-sm text-slate-500 mt-1">Last 30 days</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <MiniStat label="Approved Requests" value={leaveApproved} />
          <MiniStat label="Pending Requests" value={leavePending} />
          <MiniStat label="Approved Leave Days" value={approvedDays} />
        </div>

        <BadgeRow title="By Status" obj={leaves?.statusCounts} />
        <BadgeRow title="By Type" obj={leaves?.typeCounts} />
      </div>
    </div>
  );
};

export default SummaryCards;
