import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, DollarSign, ArrowRight } from "lucide-react";
import Loading from "./Loading";

const COLOMBO_TZ = "Asia/Colombo";

const normalizeArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data; // { data: [...] }
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const safeUpper = (v, fb = "") =>
  String(v ?? fb)
    .toUpperCase()
    .trim();

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `$${n.toLocaleString()}`;
};

// YYYY-MM-DD in Colombo TZ from a Date/ISO
const colomboDateKeyFrom = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
};

const KpiCard = ({ label, value, Icon }) => {
  return (
    <div className="card p-6 flex items-center justify-between relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-300" />
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-3xl font-semibold text-slate-900 mt-1">{value}</p>
      </div>
      <div className="p-3 bg-slate-100 rounded-xl">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
    </div>
  );
};

export default function EmployeeDashboard() {
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null);
  const [daysPresent, setDaysPresent] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [latestPayslipAmount, setLatestPayslipAmount] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const [pRes, aRes, lRes, payRes] = await Promise.allSettled([
          api.get("/profile"),
          // ✅ NEW attendance endpoint (shift-based system)
          api.get("/attendance/history?limit=500"),
          api.get("/leave?limit=500"),
          api.get("/payslips?limit=1"),
        ]);

        if (!mounted) return;

        // profile
        if (pRes.status === "fulfilled") {
          setProfile(pRes.value?.data ?? null);
        }

        // attendance -> Days Present (unique days where status PRESENT/LATE)
        if (aRes.status === "fulfilled") {
          const payload = aRes.value?.data;
          const list = normalizeArray(payload); // supports {success,data:[...]} and {data:[...]}

          const presentDayKeys = new Set();

          for (const r of list) {
            const st = safeUpper(r?.status);
            if (st !== "PRESENT" && st !== "LATE") continue;

            const key =
              r?.attendanceDateKey ||
              colomboDateKeyFrom(r?.checkIn) ||
              colomboDateKeyFrom(r?.createdAt) ||
              null;

            if (key) presentDayKeys.add(key);
          }

          setDaysPresent(presentDayKeys.size);
        }

        // leaves -> pending count
        if (lRes.status === "fulfilled") {
          const payload = lRes.value?.data;
          const list = normalizeArray(payload);

          const pendingCount = list.filter(
            (l) => safeUpper(l?.status) === "PENDING",
          ).length;

          setPendingLeaves(pendingCount);
        }

        // payslip -> latest amount
        if (payRes.status === "fulfilled") {
          const payload = payRes.value?.data;
          const list = normalizeArray(payload);

          const latest = list?.[0] || null;
          const amount =
            latest?.netPay ??
            latest?.netSalary ??
            latest?.net ??
            latest?.amount ??
            latest?.total ??
            null;

          setLatestPayslipAmount(amount);
        }
      } catch (e) {
        toast.error(
          e?.response?.data?.error || e?.message || "Failed to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const welcomeName = useMemo(() => {
    const first = profile?.firstName || profile?.name || "User";
    return String(first).toUpperCase();
  }, [profile]);

  const subtitle = useMemo(() => {
    const job =
      profile?.jobTitle ||
      profile?.designation ||
      profile?.position ||
      "Employee";
    const dept = profile?.department || profile?.departmentName || "";
    return dept ? `${job} - ${dept}` : job;
  }, [profile]);

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-semibold text-slate-900">
          Welcome, {welcomeName}!
        </h1>
        <p className="text-slate-500 mt-2">{subtitle}</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard label="Days Present" value={daysPresent} Icon={CalendarDays} />
        <KpiCard label="Pending Leaves" value={pendingLeaves} Icon={FileText} />
        <KpiCard
          label="Latest Payslip"
          value={formatMoney(latestPayslipAmount)}
          Icon={DollarSign}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          to="/attendance"
          className="btn-primary inline-flex items-center gap-2"
        >
          Mark Attendance <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          to="/leave"
          className="btn-secondary inline-flex items-center gap-2"
        >
          Apply for Leave
        </Link>
      </div>
    </div>
  );
}
