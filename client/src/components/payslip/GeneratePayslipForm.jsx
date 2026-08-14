import React, { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const GeneratePayslipForm = ({ employees, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    try {
      await api.post("/payslips", data);
      setIsOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || err?.message);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="btn-primary flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Generate Payslip
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Generate Monthly Payslip
              </h3>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employee
                </label>

                <select name="employeeId" required className="w-full">
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* Month & Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Month
                  </label>

                  <select name="month" className="w-full">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Year
                  </label>

                  <input
                    type="number"
                    name="year"
                    defaultValue={new Date().getFullYear()}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Basic Salary */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Basic Salary
                </label>

                <input
                  type="number"
                  name="basicSalary"
                  placeholder="5000"
                  required
                  className="w-full"
                />
              </div>

              {/* Allowances & Deductions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Allowances
                  </label>

                  <input
                    type="number"
                    name="allowances"
                    defaultValue="0"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Deductions
                  </label>

                  <input
                    type="number"
                    name="deductions"
                    defaultValue="0"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default GeneratePayslipForm;
