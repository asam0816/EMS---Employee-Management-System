import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, DollarSign, ArrowRight } from "lucide-react";
import Loading from "./Loading";

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `$${n.toLocaleString()}`;
};

const normalizeArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const safeUpper = (v, fallback = "") =>
  String(v ?? fallback)
    .toUpperCase()
    .trim();

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

const EmployeeDashboard = () => {
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
          api.get("/attendance?limit=500"),
          api.get("/leave?limit=500"),
          api.get("/payslips?limit=1"),
        ]);

        if (!mounted) return;

        // 1) profile
        if (pRes.status === "fulfilled") {
          setProfile(pRes.value?.data ?? null);
        }

        // 2) attendance -> Days Present (PRESENT or LATE)
        if (aRes.status === "fulfilled") {
          const payload = aRes.value?.data;
          const list = normalizeArray(payload);

          const presentCount = list.filter((r) => {
            const st = safeUpper(r?.status);
            return st === "PRESENT" || st === "LATE";
          }).length;

          setDaysPresent(presentCount);
        }

        // 3) leaves -> pending count
        if (lRes.status === "fulfilled") {
          const payload = lRes.value?.data;
          const list = normalizeArray(payload);

          const pendingCount = list.filter(
            (l) => safeUpper(l?.status) === "PENDING",
          ).length;

          setPendingLeaves(pendingCount);
        }

        // 4) payslip -> latest amount
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
        if (mounted) setLoading(false);
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

      {/* KPI Row (ONLY these 3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard label="Days Present" value={daysPresent} Icon={CalendarDays} />
        <KpiCard label="Pending Leaves" value={pendingLeaves} Icon={FileText} />
        <KpiCard
          label="Latest Payslip"
          value={formatMoney(latestPayslipAmount)}
          Icon={DollarSign}
        />
      </div>

      {/* Actions (ONLY these buttons) */}
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
};

export default EmployeeDashboard;
