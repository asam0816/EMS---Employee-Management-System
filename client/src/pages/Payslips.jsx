import { useCallback, useEffect, useState } from "react";
import { dummyEmployeeData, dummyPayslipData } from "../assets/assets";
import Loading from "../components/Loading";
import { Download } from "lucide-react";
import { format } from "date-fns";
import GeneratePayslipForm from "../components/payslip/GeneratePayslipForm";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

// ======================
// PayslipList Component
// ======================
const PayslipList = ({ payslips, isAdmin }) => {
  return (
    <div className="card overflow-hidden mt-6">
      <div className="overflow-x-auto">
        <table className="table-modern">
          <thead>
            <tr>
              {isAdmin && <th>Employee</th>}
              <th>Period</th>
              <th>Basic Salary</th>
              <th>Net Salary</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {payslips.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 5 : 4}
                  className="text-center py-12 text-slate-400"
                >
                  No payslips found
                </td>
              </tr>
            ) : (
              payslips.map((payslip) => (
                <tr key={payslip._id || payslip.id}>
                  {isAdmin && (
                    <td className="text-slate-900">
                      {payslip.employee?.firstName} {payslip.employee?.lastName}
                    </td>
                  )}

                  <td className="text-slate-500">
                    {format(
                      new Date(payslip.year, payslip.month - 1),
                      "MMM yyyy",
                    )}
                  </td>

                  <td className="text-slate-500">
                    ${payslip.basicSalary?.toLocaleString()}
                  </td>

                  <td className="font-medium text-slate-800">
                    ${payslip.netSalary?.toLocaleString()}
                  </td>

                  <td className="text-center">
                    <button
                      onClick={() =>
                        window.open(
                          `/print/payslips/${payslip._id || payslip.id}`,
                        )
                      }
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================
// Main Payslips Component
// ======================
const Payslips = () => {
  const [payslips, setPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const fetchPayslips = useCallback(async () => {
    try {
      const res = await api.get("/payslips");
      setPayslips(res.data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  useEffect(() => {
    if (isAdmin)
      api
        .get("/employees")
        .then((res) => setEmployees(res.data.filter((e) => !e.isDeleted)))
        .catch(() => {});
  }, [isAdmin]);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="page-title">Payslips</h1>

          <p className="page-subtitle">
            {isAdmin
              ? "Generate and manage employee payslips"
              : "Your payslip history"}
          </p>
        </div>

        {isAdmin && (
          <GeneratePayslipForm
            employees={employees}
            onSuccess={fetchPayslips}
          />
        )}
      </div>

      <PayslipList payslips={payslips} isAdmin={isAdmin} />
    </div>
  );
};

export default Payslips;
