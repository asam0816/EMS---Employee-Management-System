import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEPARTMENTS } from "../assets/assets";
import { Loader2 } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";

const EmployeeForm = ({ initialData, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!initialData;

  const inputClass =
    "w-full mt-2 p-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    // optional password in edit mode
    if (isEditMode) {
      const pwd = formData.get("password");
      if (!pwd) formData.delete("password");
    }

    try {
      const url = isEditMode ? `/employees/${initialData.id}` : "/employees";
      const method = isEditMode ? "put" : "post";

      await api[method](url, formData);

      toast.success(isEditMode ? "Employee updated!" : "Employee created!");
      onSuccess ? onSuccess() : navigate("/employees");
    } catch (error) {
      toast.error(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-3xl animate-fade-in"
    >
      {/* Personal Information */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-6 pb-4 border-b border-slate-100 text-lg">
          Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-700">
          <div>
            <label className="block font-medium">First Name</label>
            <input
              name="firstName"
              type="text"
              required
              defaultValue={initialData?.firstName}
              className={inputClass}
              placeholder="Enter first name"
            />
          </div>

          <div>
            <label className="block font-medium">Last Name</label>
            <input
              name="lastName"
              type="text"
              required
              defaultValue={initialData?.lastName}
              className={inputClass}
              placeholder="Enter last name"
            />
          </div>

          <div>
            <label className="block font-medium">Phone Number</label>
            <input
              name="phone"
              type="text"
              required
              defaultValue={initialData?.phone}
              className={inputClass}
              placeholder="Enter phone number"
            />
          </div>

          {/* ✅ NIC */}
          <div>
            <label className="block font-medium">National ID Number</label>
            <input
              name="nationalIdNumber"
              type="text"
              required
              defaultValue={initialData?.nationalIdNumber || ""}
              className={inputClass}
              placeholder="Enter NIC number"
            />
          </div>

          <div>
            <label className="block font-medium">Join Date</label>
            <input
              type="date"
              name="joinDate"
              required
              defaultValue={
                initialData?.joinDate
                  ? new Date(initialData.joinDate).toISOString().split("T")[0]
                  : ""
              }
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-medium">Bio (Optional)</label>
            <textarea
              name="bio"
              defaultValue={initialData?.bio}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Write a brief description..."
            />
          </div>
        </div>
      </div>

      {/* Employment Details */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-6 pb-4 border-b border-slate-100 text-lg">
          Employment Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-700">
          <div>
            <label className="block font-medium">Department</label>
            <select
              name="department"
              defaultValue={initialData?.department || ""}
              className={inputClass}
              required
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map((deptName) => (
                <option key={deptName} value={deptName}>
                  {deptName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium">Position</label>
            <input
              name="position"
              type="text"
              required
              defaultValue={initialData?.position}
              className={inputClass}
              placeholder="e.g. Software Developer"
            />
          </div>

          <div>
            <label className="block font-medium">Basic Salary</label>
            <input
              type="number"
              name="basicSalary"
              required
              min="0"
              step="0.01"
              defaultValue={initialData?.basicSalary ?? 0}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block font-medium">Allowances</label>
            <input
              type="number"
              name="allowances"
              required
              min="0"
              step="0.01"
              defaultValue={initialData?.allowances ?? 0}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block font-medium">Deductions</label>
            <input
              type="number"
              name="deductions"
              required
              min="0"
              step="0.01"
              defaultValue={initialData?.deductions ?? 0}
              className={inputClass}
            />
          </div>

          {isEditMode && (
            <div>
              <label className="block font-medium">Status</label>
              <select
                name="employmentStatus"
                defaultValue={initialData?.employmentStatus || "ACTIVE"}
                className={inputClass}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Account Setup */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-6 pb-4 border-b border-slate-100 text-lg">
          Account Setup
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-slate-700">
          <div className="sm:col-span-2">
            <label className="block font-medium">Work Email</label>
            <input
              type="email"
              name="email"
              required
              defaultValue={initialData?.email}
              className={inputClass}
              placeholder="example@company.com"
            />
          </div>

          {!isEditMode && (
            <div>
              <label className="block font-medium">Temporary Password</label>
              <input
                type="password"
                name="password"
                required
                className={inputClass}
                placeholder="Enter password"
              />
            </div>
          )}

          {isEditMode && (
            <div>
              <label className="block font-medium">
                Change Password (Optional)
              </label>
              <input
                type="password"
                name="password"
                placeholder="Leave blank to keep current"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block font-medium">System Role</label>
            <select
              name="role"
              defaultValue={initialData?.user?.role || "EMPLOYEE"}
              className={inputClass}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
        <button
          type="button"
          className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium w-full sm:w-auto"
          onClick={() => (onCancel ? onCancel() : navigate(-1))}
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center disabled:opacity-60 transition-colors w-full sm:w-auto"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditMode ? "Update Employee" : "Create Employee"}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;
