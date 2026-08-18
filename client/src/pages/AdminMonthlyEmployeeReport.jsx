import { useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const Chip = ({ text }) => (
  <span className="px-2.5 py-1 rounded-full text-xs border border-slate-200 bg-slate-50 text-slate-700">
    {text}
  </span>
);

const AdminMonthlyEmployeeReport = () => {
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/reports/monthly-employees?month=${month}`,
      );
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      toast.error(
        e?.response?.data?.error || e?.message || "Failed to load report",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Monthly Employee Report</h1>
        <p className="page-subtitle">
          Attendance + Leave (type & status) summary per employee
        </p>
      </div>

      <div className="card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Select Month</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{month}</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200"
          />
          <button onClick={fetchReport} className="btn-secondary">
            Refresh
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-slate-500">Loading...</div>
          ) : (
            <table className="table-modern min-w-[1400px]">
              <thead>
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Dept</th>

                  <th className="px-6 py-4">Present</th>
                  <th className="px-6 py-4">Late</th>
                  <th className="px-6 py-4">Absent</th>

                  <th className="px-6 py-4">Full</th>
                  <th className="px-6 py-4">Half</th>
                  <th className="px-6 py-4">Hours</th>

                  <th className="px-6 py-4">Leave Status</th>
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">Approved Days</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center py-12 text-slate-400"
                    >
                      No data found
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.employeeId}>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {r.name}
                        <div className="text-xs text-slate-500 mt-1">
                          {r.jobTitle}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {r.department}
                      </td>

                      <td className="px-6 py-4">
                        {r.attendance?.present || 0}
                      </td>
                      <td className="px-6 py-4">{r.attendance?.late || 0}</td>
                      <td className="px-6 py-4">{r.attendance?.absent || 0}</td>

                      <td className="px-6 py-4">
                        {r.attendance?.fullDay || 0}
                      </td>
                      <td className="px-6 py-4">
                        {r.attendance?.halfDay || 0}
                      </td>
                      <td className="px-6 py-4">
                        {r.attendance?.totalHours || 0}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(r.leaves?.statusCounts || {})
                            .length ? (
                            Object.entries(r.leaves.statusCounts).map(
                              ([k, v]) => <Chip key={k} text={`${k}: ${v}`} />,
                            )
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(r.leaves?.typeCounts || {}).length ? (
                            Object.entries(r.leaves.typeCounts).map(
                              ([k, v]) => <Chip key={k} text={`${k}: ${v}`} />,
                            )
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {r.leaves?.approvedDays || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMonthlyEmployeeReport;
