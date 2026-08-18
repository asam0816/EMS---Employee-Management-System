import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Clock, CalendarDays, AlertCircle } from "lucide-react";
import api from "../api/axios";
import Loading from "../components/Loading";

const COLOMBO_TZ = "Asia/Colombo";

const normalizeArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const safeUpper = (v, fallback = "") =>
  String(v ?? fallback)
    .toUpperCase()
    .trim();

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

  const dt = new Date(Date.UTC(y, m - 1, d));
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

// ✅ Working minutes for CLOSED records or ONGOING records
const getWorkingMinutes = (row, now = new Date()) => {
  // Prefer backend-calculated minutes/hours if present
  const wm = Number(row?.workingMinutes);
  if (Number.isFinite(wm) && wm >= 0) return wm;

  const wh = Number(row?.workingHours);
  if (Number.isFinite(wh) && wh >= 0) return Math.round(wh * 60);

  const checkIn = row?.checkIn ? new Date(row.checkIn) : null;
  if (!checkIn || isNaN(checkIn.getTime())) return null;

  // If checkOut exists -> compute closed duration
  if (row?.checkOut) {
    const checkOut = new Date(row.checkOut);
    if (isNaN(checkOut.getTime())) return null;
    const diff = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
    return diff >= 0 ? diff : null;
  }

  // ✅ If checkOut missing -> ongoing duration from now
  const diff = Math.round((now.getTime() - checkIn.getTime()) / 60000);
  return diff >= 0 ? diff : 0;
};

const Badge = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const KpiCard = ({ label, value, Icon }) => (
  <div className="card p-6 flex items-center justify-between relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-300" />
    <div className="flex items-center gap-4">
      <div className="p-3 bg-slate-100 rounded-xl">
        <Icon className="w-5 h-5 text-slate-700" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-3xl font-semibold text-slate-900 mt-1">{value}</p>
      </div>
    </div>
  </div>
);

export default function Attendance() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // live clock (also updates ongoing working hours)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);

  const load = async () => {
    const [sRes, aRes] = await Promise.all([
      api.get("/attendance/status"),
      api.get("/attendance?limit=50"),
    ]);

    setStatus(sRes.data);
    setHistory(normalizeArray(aRes.data));
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

    return () => {
      mounted = false;
    };
  }, []);

  // refresh status every 15 seconds
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const sRes = await api.get("/attendance/status");
        setStatus(sRes.data);
      } catch {
        // ignore
      }
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const list = Array.isArray(history) ? history : [];

    const presentRows = list.filter((r) => {
      const st = safeUpper(r?.status);
      return st === "PRESENT" || st === "LATE";
    });

    const lateRows = list.filter((r) => safeUpper(r?.status) === "LATE");

    // ✅ avg should use CLOSED records only (real completed hours)
    const closedPresent = presentRows.filter((r) => !!r?.checkOut);
    const mins = closedPresent
      .map((r) => getWorkingMinutes(r, now))
      .filter((m) => Number.isFinite(m) && m > 0);

    const avgMin = mins.length
      ? mins.reduce((a, b) => a + b, 0) / mins.length
      : null;
    const avgHrs = avgMin == null ? null : avgMin / 60;

    return {
      daysPresent: presentRows.length,
      lateArrivals: lateRows.length,
      avgWorkHrsLabel:
        avgHrs == null ? "-" : `${String(parseFloat(avgHrs.toFixed(2)))} Hrs`,
    };
  }, [history, now]);

  const canClockIn = Boolean(status?.canClockIn);
  const canClockOut = Boolean(status?.canClockOut);

  const showButton = canClockIn || canClockOut;
  const buttonLabel = canClockOut ? "Clock Out" : "Clock In";

  const currentShiftLabel =
    status?.currentShift?.shiftLabel ||
    (status?.currentShift?.shiftKey
      ? String(status.currentShift.shiftKey)
      : "-");

  const onToggleAttendance = async () => {
    try {
      setActionLoading(true);
      await api.post("/attendance"); // toggle clock in/out
      await load();
      toast.success("Attendance updated");
    } catch (e) {
      toast.error(
        e?.response?.data?.error || e?.message || "Attendance failed",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-slate-500 mt-2">
          Track your work hours and daily check-ins
        </p>
      </div>

      {/* Time card + button */}
      <div className="space-y-3">
        <div className="card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-slate-500">Current Colombo Time</p>
            <p className="text-2xl md:text-3xl font-semibold text-slate-900 mt-1">
              {formatColomboNow(now)}
            </p>
          </div>

          <div className="shrink-0">
            {showButton ? (
              <button
                className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                onClick={onToggleAttendance}
                disabled={actionLoading}
                type="button"
              >
                <Clock className="w-4 h-4" />
                {actionLoading ? "Please wait..." : buttonLabel}
              </button>
            ) : (
              <Badge tone={status?.inShiftWindow ? "indigo" : "slate"}>
                {status?.inShiftWindow ? "Completed" : "Outside shift time"}
              </Badge>
            )}
          </div>
        </div>

        <p className="text-slate-500 text-sm">
          Current shift:{" "}
          <span className="text-slate-700 font-medium">
            {currentShiftLabel}
          </span>
        </p>
      </div>

      {/* KPI row */}
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

      {/* Recent activity */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Activity
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
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
                  <td className="px-6 py-6 text-slate-500" colSpan={7}>
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                history.slice(0, 10).map((r) => {
                  const shift = safeUpper(r?.shiftKey || "-");
                  const statusText = safeUpper(r?.status || "-");

                  const isOpen = !!r?.checkIn && !r?.checkOut;

                  const minutes = getWorkingMinutes(r, now);
                  const durationLabel =
                    minutes == null
                      ? "-"
                      : `${formatDuration(minutes)}${isOpen ? " (ongoing)" : ""}`;

                  const dayTypeLabel = isOpen
                    ? "In Progress"
                    : r?.dayType || "-";

                  const dayTone = isOpen
                    ? "indigo"
                    : String(dayTypeLabel).toLowerCase().includes("full")
                      ? "green"
                      : String(dayTypeLabel).toLowerCase().includes("half")
                        ? "slate"
                        : dayTypeLabel === "-"
                          ? "slate"
                          : "rose";

                  const statusTone =
                    statusText === "PRESENT"
                      ? "green"
                      : statusText === "LATE"
                        ? "amber"
                        : "rose";

                  return (
                    <tr
                      key={r?._id || r?.id}
                      className="border-b border-slate-50"
                    >
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
                        {durationLabel}
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
