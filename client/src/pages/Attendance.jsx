import { useCallback, useEffect, useMemo, useState } from "react";
import Loading from "../components/Loading";
import CheckInButton from "../components/attendance/CheckInButton";
import AttendanceStats from "../components/attendance/AttendanceStats";
import AttendanceHistory from "../components/attendance/AttendanceHistory";
import api from "../api/axios";
import toast from "react-hot-toast";

const Attendance = () => {
  const [history, setHistory] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/attendance");
      const json = res.data;

      setHistory(Array.isArray(json.data) ? json.data : []);
      setTodayRecord(json.todayRecord || null);
      setCurrentShift(json.currentShift || null);

      if (json.employee?.isDeleted) setIsDeleted(true);
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to fetch attendance",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ✅ auto refresh every 1 minute
  useEffect(() => {
    const id = setInterval(() => {
      fetchData();
    }, 60000); // every 1 min
    return () => clearInterval(id);
  }, [fetchData]);

  const summary = useMemo(() => {
    return {
      shiftLabel: currentShift?.shiftLabel || null,
      inShiftWindow: Boolean(currentShift?.inShiftWindow),
    };
  }, [currentShift]);

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Attendance</h1>
        <p className="page-subtitle">
          Track your work hours and daily check-ins
        </p>
      </div>

      {isDeleted ? (
        <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center">
          <p className="text-rose-600">
            You can no longer clock in or out because your employee records have
            been marked as deleted.
          </p>
        </div>
      ) : (
        <div className="mb-8">
          <CheckInButton
            todayRecord={todayRecord}
            currentShift={currentShift}
            onAction={fetchData}
          />
          {summary.shiftLabel && (
            <p className="text-xs text-slate-500 mt-2">
              Current shift: {summary.shiftLabel}
            </p>
          )}
        </div>
      )}

      <AttendanceStats history={history} />
      <AttendanceHistory history={history} />
    </div>
  );
};

export default Attendance;
