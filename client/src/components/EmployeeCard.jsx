import { useState } from "react";

import { Ban, CheckCircle2, PencilIcon, Trash2Icon } from "lucide-react";

import toast from "react-hot-toast";

import api from "../api/axios";

const getInitials = (employee) => {
  const f = String(employee?.firstName || "").trim();

  const l = String(employee?.lastName || "").trim();

  const a = f ? f[0] : "U";
  const b = l ? l[0] : "N";

  return `${a}${b}`.toUpperCase();
};

const EmployeeCard = ({ employee, onDelete, onEdit, onStatusChange }) => {
  const [statusLoading, setStatusLoading] = useState(false);

  const accountStatus =
    employee?.user?.accountStatus ||
    (employee?.employmentStatus === "INACTIVE" ? "SUSPENDED" : "ACTIVE");

  const isSuspended = accountStatus === "SUSPENDED";

  const handleStatusChange = async () => {
    const id = employee?.id ?? employee?._id;

    if (!id) {
      return toast.error("Employee id not found");
    }

    const nextStatus = isSuspended ? "ACTIVE" : "SUSPENDED";

    const actionText = isSuspended ? "activate" : "suspend";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${employee.firstName}'s account?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setStatusLoading(true);

      await api.patch(`/employees/${id}/account-status`, {
        accountStatus: nextStatus,
      });

      toast.success(
        nextStatus === "SUSPENDED" ? "Account suspended" : "Account activated",
      );

      onStatusChange?.();
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to update account status",
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    const id = employee?.id ?? employee?._id;

    if (!id) {
      return toast.error("Employee id not found");
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this employee?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/employees/${id}`);

      toast.success("Employee deleted");

      onDelete?.();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || err?.message || "Delete failed",
      );
    }
  };

  return (
    <div className="group relative card card-hover overflow-hidden">
      {/* Avatar */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 flex items-center justify-center">
            <span className="text-2xl font-semibold text-indigo-400 tracking-tight">
              {getInitials(employee)}
            </span>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
        <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-slate-600 rounded-lg shadow-sm">
          {employee?.department || "Remote"}
        </span>

        {!employee?.isDeleted && (
          <span
            className={`
              px-2.5
              py-1
              text-xs
              font-semibold
              rounded-lg
              shadow-sm

              ${
                isSuspended
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }
            `}
          >
            {isSuspended ? "SUSPENDED" : "ACTIVE"}
          </span>
        )}

        {employee?.isDeleted && (
          <span className="bg-red-500/80 font-medium text-white px-2.5 py-1 text-xs rounded-lg">
            DELETED
          </span>
        )}
      </div>

      {/* Information */}
      <div className="p-5">
        <h3 className="text-slate-900 font-medium">
          {employee?.firstName || "Unknown"} {employee?.lastName || ""}
        </h3>

        <p className="text-xs text-slate-500 mt-0.5">
          {employee?.position || employee?.jobTitle || "-"}
        </p>

        {!employee?.isDeleted && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {/* Edit */}
            <button
              type="button"
              onClick={() => onEdit?.(employee)}
              className="
                flex
                items-center
                justify-center
                gap-1.5
                px-2
                py-2
                text-xs
                font-medium
                border
                border-slate-200
                rounded-lg
                text-slate-700
                hover:bg-slate-50
              "
            >
              <PencilIcon className="w-3.5 h-3.5" />
              Edit
            </button>

            {/* Suspend / Activate */}
            <button
              type="button"
              onClick={handleStatusChange}
              disabled={statusLoading}
              className={`
                flex
                items-center
                justify-center
                gap-1.5
                px-2
                py-2
                text-xs
                font-medium
                border
                rounded-lg
                disabled:opacity-60

                ${
                  isSuspended
                    ? "border-green-200 text-green-700 hover:bg-green-50"
                    : "border-amber-200 text-amber-700 hover:bg-amber-50"
                }
              `}
            >
              {isSuspended ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Ban className="w-3.5 h-3.5" />
              )}

              {statusLoading
                ? "Saving..."
                : isSuspended
                  ? "Activate"
                  : "Suspend"}
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              className="
                flex
                items-center
                justify-center
                gap-1.5
                px-2
                py-2
                text-xs
                font-medium
                border
                border-rose-200
                rounded-lg
                text-rose-600
                hover:bg-rose-50
              "
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeCard;
