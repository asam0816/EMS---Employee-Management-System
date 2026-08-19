import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Clock, CalendarDays, AlertCircle, Timer } from "lucide-react";
import api from "../api/axios";
import Loading from "../components/Loading";

const COLOMBO_TZ = "Asia/Colombo";

const safeUpper = (v, fallback = "") =>
  String(v ?? fallback)
    .toUpperCase()
    .trim();

const normalizeArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const formatColomboNow = (date = new Date()) => {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBO_TZ,
    weekday: "short",
  }).format(date);
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace("AM", "am")
    .replace("PM", "pm");
  return `${weekday}, ${dateStr}, ${timeStr}`;
};

const formatDateKeyPretty = (dateKey) => {
  if (!dateKey) return "-";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
};

const formatColomboTimeOnly = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
};

const formatDuration = (minutes) => {
  const n = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * ✅ FIXED: For open records (no checkOut), ALWAYS compute now - checkIn.
 * We can still use DB minutes, but we take the max() so it never stays 0.
 */
const getWorkingMinutes = (row, now = new Date()) => {
  const checkIn = row?.checkIn ? new Date(row.checkIn) : null;
  const checkOut = row?.checkOut ? new Date(row.checkOut) : null;

  const dbTotal = Number(row?.totalWorkingMinutes);
  if (Number.isFinite(dbTotal) && dbTotal >= 0) return dbTotal;

  // CLOSED record -> compute from times if needed
  if (checkIn && !isNaN(checkIn) && checkOut && !isNaN(checkOut)) {
    const diff = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
    if (diff >= 0) return diff;
  }

  // OPEN record -> compute ongoing from now
  if (checkIn && !isNaN(checkIn) && !row?.checkOut) {
    const computed = Math.round((now.getTime() - checkIn.getTime()) / 60000);
    const dbLive = Number(row?.workingMinutes);
    const fromDb = Number.isFinite(dbLive) && dbLive >= 0 ? dbLive : 0;
    return Math.max(0, Math.max(computed, fromDb));
  }

  // fallback: DB live hours/minutes
  const wm = Number(row?.workingMinutes);
  if (Number.isFinite(wm) && wm >= 0) return wm;

  const wh = Number(row?.workingHours);
  if (Number.isFinite(wh) && wh >= 0) return Math.round(wh * 60);

  return null;
};

const Badge = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
};

const SmallCard = ({ label, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs text-slate-500">{label}</p>
    <div className="mt-2">{children}</div>
  </div>
);

const KpiCard = ({ label, value, Icon }) => (
  <div className="card p-6 relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-slate-300" />
    <div className="flex items-center gap-5 pl-2">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-slate-700" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-4xl font-semibold text-slate-900 mt-1 leading-none">
          {value}
        </p>
      </div>
    </div>
  </div>
);

export default function Attendance() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [now, setNow] = useState(() => new Date());
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const [tRes, hRes] = await Promise.all([
      api.get("/attendance/today"),
      api.get("/attendance/history?limit=20"),
    ]);
    setToday(tRes.data);
    setHistory(normalizeArray(hRes.data));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        toast.error(
          e?.response?.data?.error || e?.message || "Failed to load attendance",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    const t = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(t);
  }, []);

  const record = today?.openRecord || today?.todayRecord || null;
  const canClockIn = Boolean(today?.canClockIn);
  const canClockOut = Boolean(today?.canClockOut);

  const shiftName = today?.shift?.shiftName || "-";
  const shiftLabel = today?.shift?.label || "-";

  const status = useMemo(() => {
    const state = record?.attendanceState;
    if (!record?.checkIn) return { label: "Not Clocked In", tone: "slate" };
    if (state === "WORKING") return { label: "Working", tone: "indigo" };
    if (state === "COMPLETED") return { label: "Completed", tone: "green" };
    if (state === "AUTO_CLOCKED_OUT")
      return { label: "Auto Clocked Out", tone: "amber" };
    if (record?.checkOut) return { label: "Completed", tone: "green" };
    return { label: "Working", tone: "indigo" };
  }, [record]);

  const workingMins = useMemo(() => {
    if (!record?.checkIn) return 0;
    return getWorkingMinutes(record, now) ?? 0;
  }, [record, now]);

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      await api.post("/attendance/clock-in");
      await load();
      toast.success("Clock in successful");
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Clock in failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      await api.post("/attendance/clock-out");
      await load();
      toast.success("Clock out successful");
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Clock out failed");
    } finally {
      setActionLoading(false);
    }
  };

  const stats = useMemo(() => {
    const list = Array.isArray(history) ? history : [];

    const presentRows = list.filter((r) => {
      const st = safeUpper(r?.status);
      return st === "PRESENT" || st === "LATE";
    });

    const lateRows = list.filter((r) => safeUpper(r?.status) === "LATE");

    const closed = presentRows.filter((r) => !!r?.checkOut);
    const mins = closed
      .map((r) => getWorkingMinutes(r, now))
      .filter((m) => Number.isFinite(m) && m > 0);

    const avgMin = mins.length
      ? mins.reduce((a, b) => a + b, 0) / mins.length
      : null;
    const avgLabel = avgMin == null ? "-" : `${(avgMin / 60).toFixed(2)} Hrs`;

    return {
      daysPresent: presentRows.length,
      lateArrivals: lateRows.length,
      avgWorkHrsLabel: avgLabel,
    };
  }, [history, now]);

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-slate-500 mt-2">
          Shift-based clock-in/out with automatic clock-out.
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard
          label="Days Present"
          value={stats.daysPresent}
          Icon={CalendarDays}
        />
        <KpiCard
          label="Late Arrivals"
          value={stats.lateArrivals}
          Icon={AlertCircle}
        />
        <KpiCard
          label="Avg. Work Hrs"
          value={stats.avgWorkHrsLabel}
          Icon={Clock}
        />
      </div>

      {/* Top Card */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-slate-500">Current Colombo Time</p>
            <p className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              {formatColomboNow(now)}
            </p>
          </div>

          <div className="shrink-0">
            {canClockOut ? (
              <button
                className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                onClick={handleClockOut}
                disabled={actionLoading}
                type="button"
              >
                <Clock className="w-4 h-4" />
                {actionLoading ? "Please wait..." : "Clock Out"}
              </button>
            ) : canClockIn ? (
              <button
                className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                onClick={handleClockIn}
                disabled={actionLoading}
                type="button"
              >
                <Clock className="w-4 h-4" />
                {actionLoading ? "Please wait..." : "Clock In"}
              </button>
            ) : (
              <Badge tone="slate">Completed</Badge>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <SmallCard label="Shift">
            <p className="text-xl font-semibold text-slate-900">{shiftName}</p>
            <p className="text-sm text-slate-600 mt-1">{shiftLabel}</p>
          </SmallCard>

          <SmallCard label="Status">
            <Badge tone={status.tone}>{status.label}</Badge>
          </SmallCard>

          <SmallCard label="Work Date">
            <p className="text-2xl font-semibold text-slate-900">
              {formatDateKeyPretty(
                record?.attendanceDateKey || today?.shift?.workDateKey || "-",
              )}
            </p>
          </SmallCard>

          <SmallCard label="Clock In">
            <p className="text-2xl font-semibold text-slate-900">
              {record?.checkIn ? formatColomboTimeOnly(record.checkIn) : "-"}
            </p>
          </SmallCard>

          <SmallCard label="Scheduled Clock Out">
            <p className="text-2xl font-semibold text-slate-900">
              {record?.scheduledEndAt
                ? formatColomboTimeOnly(record.scheduledEndAt)
                : "-"}
            </p>
          </SmallCard>

          <SmallCard label="Clock Out">
            <p className="text-2xl font-semibold text-slate-900">
              {record?.checkOut ? formatColomboTimeOnly(record.checkOut) : "-"}
            </p>
          </SmallCard>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-600">
                <Timer className="w-4 h-4" />
                <p className="text-sm font-medium text-slate-700">
                  Current Working Time
                </p>
              </div>
              <p className="text-3xl font-semibold text-slate-900 mt-2">
                {record?.checkIn ? formatDuration(workingMins) : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity (your screenshot style) */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Activity
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 font-semibold">DATE</th>
                <th className="px-6 py-4 font-semibold">SHIFT</th>
                <th className="px-6 py-4 font-semibold">CHECK IN</th>
                <th className="px-6 py-4 font-semibold">CHECK OUT</th>
                <th className="px-6 py-4 font-semibold">WORKING HOURS</th>
                <th className="px-6 py-4 font-semibold">DAY TYPE</th>
                <th className="px-6 py-4 font-semibold">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={7}>
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                history.slice(0, 10).map((r) => {
                  const shift = safeUpper(r?.shiftKey || "-");
                  const statusText = safeUpper(r?.status || "-");
                  const isOpen = !!r?.checkIn && !r?.checkOut;

                  const mins = getWorkingMinutes(r, now);
                  const workingLabel =
                    mins == null
                      ? "-"
                      : `${formatDuration(mins)}${isOpen ? " (ongoing)" : ""}`;

                  const dayTypeLabel = isOpen
                    ? "In Progress"
                    : r?.dayType || "-";

                  const dayTone = isOpen
                    ? "indigo"
                    : String(dayTypeLabel).toLowerCase().includes("full")
                      ? "green"
                      : "slate";

                  const statusTone =
                    statusText === "PRESENT"
                      ? "green"
                      : statusText === "LATE"
                        ? "amber"
                        : statusText === "ABSENT"
                          ? "rose"
                          : "slate";

                  return (
                    <tr key={r?._id} className="border-b border-slate-50">
                      <td className="px-6 py-5 text-slate-900 font-medium">
                        {formatDateKeyPretty(r?.attendanceDateKey)}
                      </td>
                      <td className="px-6 py-5 text-slate-700">{shift}</td>
                      <td className="px-6 py-5 text-slate-700">
                        {r?.checkIn ? formatColomboTimeOnly(r.checkIn) : "-"}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {r?.checkOut ? formatColomboTimeOnly(r.checkOut) : "-"}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {workingLabel}
                      </td>
                      <td className="px-6 py-5">
                        <Badge tone={dayTone}>{dayTypeLabel}</Badge>
                      </td>
                      <td className="px-6 py-5">
                        <Badge tone={statusTone}>{statusText}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
