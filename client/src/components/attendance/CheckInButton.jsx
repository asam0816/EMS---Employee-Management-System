import { useMemo, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

const getColomboNowLabel = () => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
};

const CheckInButton = ({ todayRecord, currentShift, onAction }) => {
  const [loading, setLoading] = useState(false);

  const isCheckedIn = Boolean(todayRecord?.checkIn && !todayRecord?.checkOut);
  const isCheckedOut = Boolean(todayRecord?.checkOut);

  const secondsSinceCheckIn = useMemo(() => {
    if (!todayRecord?.checkIn) return null;
    return (Date.now() - new Date(todayRecord.checkIn).getTime()) / 1000;
  }, [todayRecord?.checkIn]);

  const disableClockOutFor10s = isCheckedIn && secondsSinceCheckIn < 10;

  // ✅ Show button if inside shift OR user needs to clock out
  const canShowAction = isCheckedIn || Boolean(currentShift?.inShiftWindow);

  const buttonLabel = useMemo(() => {
    if (isCheckedOut) return "Work Day Completed";
    if (isCheckedIn)
      return disableClockOutFor10s ? "Clock Out (wait...)" : "Clock Out";
    return "Clock In";
  }, [isCheckedIn, isCheckedOut, disableClockOutFor10s]);

  const handleClick = async () => {
    if (loading) return;
    if (isCheckedOut) return;

    if (!isCheckedIn && !currentShift?.inShiftWindow) {
      toast.error(
        "Clock In allowed only during shifts (08:00-17:00, 19:00-04:00).",
      );
      return;
    }

    if (disableClockOutFor10s) return;

    setLoading(true);
    try {
      const { data } = await api.post("/attendance");

      toast.success(
        data?.type === "CHECK_IN"
          ? "Clock in successful"
          : "Clock out successful",
      );

      onAction?.();
    } catch (error) {
      toast.error(
        error?.response?.data?.error || error?.message || "Operation failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Current Colombo Time</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {getColomboNowLabel()}
          </p>

          {!currentShift?.inShiftWindow && !isCheckedIn && (
            <p className="text-xs text-slate-500 mt-2">
              Attendance available only at: 08:00 AM–05:00 PM and 07:00 PM–04:00
              AM
            </p>
          )}
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          {isCheckedOut ? (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              Work Day Completed
            </div>
          ) : canShowAction ? (
            <button
              onClick={handleClick}
              disabled={loading || disableClockOutFor10s}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              {loading ? "Processing..." : buttonLabel}
            </button>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-medium">
              Outside shift time
            </div>
          )}

          {todayRecord && !isCheckedOut && (
            <p className="text-sm text-slate-500">
              {isCheckedIn
                ? `Checked in at ${todayRecord.checkInLabel || new Date(todayRecord.checkIn).toLocaleTimeString()}`
                : "Ready to clock in"}
            </p>
          )}

          {todayRecord?.checkOut && (
            <p className="text-sm text-slate-500">
              Checked out at{" "}
              {todayRecord.checkOutLabel ||
                new Date(todayRecord.checkOut).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInButton;
