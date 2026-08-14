import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, ShieldCheck } from "lucide-react";
import api from "../api/axios";
import Loading from "../components/Loading";
import toast from "react-hot-toast";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [downloading, setDownloading] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/audit", {
        params: { q: q || undefined, action: action || undefined, limit: 100 },
      });
      setLogs(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [q, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionsList = useMemo(() => {
    const s = new Set(logs.map((l) => l.action).filter(Boolean));
    return Array.from(s).sort();
  }, [logs]);

  const downloadCSV = async () => {
    try {
      setDownloading(true);
      const res = await api.get("/audit/export", {
        params: { q: q || undefined, action: action || undefined },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          Audit Logs
        </h1>
        <p className="page-subtitle">Admin-only system activity report</p>
      </div>

      <div className="card p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, action, entity..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full sm:w-64 py-2.5 px-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All Actions</option>
              {actionsList.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <button
              onClick={downloadCSV}
              disabled={downloading}
              className="btn-primary flex items-center justify-center gap-2 px-4"
              type="button"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Downloading..." : "Export"}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="text-left py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="text-left py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="text-left py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="text-left py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">
                  IP
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {l.actorEmail}
                      </div>
                      <div className="text-xs text-slate-400">
                        {l.actorRole}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {l.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-[420px]">
                      <div className="font-medium">{l.entityType}</div>
                      <div
                        className="text-xs text-slate-500 truncate"
                        title={l.entityLabel}
                      >
                        {l.entityLabel}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                      {l.ipAddress || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
