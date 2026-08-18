import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const currentMonthKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};

const AdminMonthlyEmployeeSummary = () => {
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const fetchRows = async (m) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/summary/admin/employees-monthly?month=${m}`,
      );
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      toast.error(
        e?.response?.data?.error ||
          e?.message ||
          "Failed to load monthly summary",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(month);
  }, [month]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.present += (r.attendance?.present || 0) + (r.attendance?.late || 0);
        acc.pendingLeaves += r.leaves?.pending || 0;
        return acc;
      },
      { present: 0, pendingLeaves: 0 },
    );
  }, [rows]);

  return (
    <div className="card p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Monthly Employee Summary
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            View attendance + leaves for each employee (month-wise)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
        <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
          Total Present: {totals.present}
        </span>
        <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
          Pending Leaves: {totals.pendingLeaves}
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-slate-500">Loading...</div>
        ) : (
          <table className="table-modern min-w-[1000px]">
            <thead>
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Dept</th>
                <th className="px-6 py-4">Present</th>
                <th className="px-6 py-4">Late</th>
                <th className="px-6 py-4">Full</th>
                <th className="px-6 py-4">Half</th>
                <th className="px-6 py-4">Hours</th>
                <th className="px-6 py-4">Leaves (A/P)</th>
                <th className="px-6 py-4">Approved Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-slate-400"
                  >
                    No employees / no data
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
                    <td className="px-6 py-4 text-slate-600">{r.department}</td>

                    <td className="px-6 py-4 text-slate-700">
                      {(r.attendance?.present || 0) + (r.attendance?.late || 0)}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {r.attendance?.late || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {r.attendance?.fullDay || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {r.attendance?.halfDay || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {r.attendance?.totalHours || 0}
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      {r.leaves?.approved || 0}/{r.leaves?.pending || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
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
  );
};

export default AdminMonthlyEmployeeSummary;
