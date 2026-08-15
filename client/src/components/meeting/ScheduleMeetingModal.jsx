import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Users, X } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const toLocalDateTimeValue = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const buildInitialForm = (meeting) => {
  if (!meeting) {
    return {
      employeeId: "",
      title: "",
      type: "ONE_TO_ONE",
      scheduledAt: toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
      durationMinutes: "30",
    };
  }

  return {
    employeeId:
      meeting.audience === "ALL"
        ? "ALL"
        : meeting.employeeId?._id || meeting.employeeId || "",
    title: meeting.title || "",
    type: meeting.type || "ONE_TO_ONE",
    scheduledAt: meeting.scheduledAt
      ? toLocalDateTimeValue(new Date(meeting.scheduledAt))
      : toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
    durationMinutes: String(meeting.durationMinutes || 30),
  };
};

const getEmployeesFromResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.employees)) return data.employees;
  return [];
};

const ScheduleMeetingModal = ({ open, onClose, onSuccess, meeting = null }) => {
  const isEditMode = Boolean(meeting?.id);

  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(buildInitialForm(meeting));

  const inputClass =
    "w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed";

  const minDateTime = toLocalDateTimeValue(new Date());

  useEffect(() => {
    if (!open) return;

    setForm(buildInitialForm(meeting));
    setEmployees([]);
    setEmployeesLoading(true);

    let cancelled = false;

    const loadEmployees = async () => {
      try {
        const { data } = await api.get("/employees");
        if (cancelled) return;

        const activeEmployees = getEmployeesFromResponse(data).filter(
          (employee) =>
            !employee.isDeleted && employee.employmentStatus === "ACTIVE",
        );

        setEmployees(activeEmployees);
      } catch (error) {
        if (cancelled) return;
        toast.error(error.response?.data?.error || "Failed to load employees");
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    };

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [open, meeting]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, loading, onClose]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const payload = useMemo(() => {
    return {
      audience: form.employeeId === "ALL" ? "ALL" : "INDIVIDUAL",
      title: form.title.trim(),
      type: form.type,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMinutes: Number(form.durationMinutes) || 30,
      ...(form.employeeId === "ALL" ? {} : { employeeId: form.employeeId }),
    };
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.employeeId) {
      toast.error("Please select an employee or All Employees");
      return;
    }

    if (!form.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }

    if (!form.scheduledAt) {
      toast.error("Please select a date and time");
      return;
    }

    const scheduledDate = new Date(form.scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      toast.error("Please select a valid date and time");
      return;
    }

    if (scheduledDate.getTime() < Date.now()) {
      toast.error("Meeting time must be in the future");
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        await api.put(`/meetings/${meeting.id}`, payload);
        toast.success("Meeting updated");
      } else {
        await api.post("/meetings", payload);
        toast.success(
          form.employeeId === "ALL"
            ? "Meeting scheduled for all employees"
            : "Meeting scheduled",
        );
      }

      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          (isEditMode
            ? "Failed to update meeting"
            : "Failed to schedule meeting"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = () => {
    if (!loading) onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEditMode ? "Edit Meeting" : "Schedule Meeting"}
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Schedule an employee or company-wide meeting
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Participants
            </label>

            <select
              name="employeeId"
              required
              value={form.employeeId}
              onChange={(e) => updateField("employeeId", e.target.value)}
              className={inputClass}
              disabled={loading}
            >
              <option value="">
                {employeesLoading ? "Loading employees..." : "Select employee"}
              </option>

              <option value="ALL">🌐 All Employees</option>

              {employees.map((employee) => {
                const id = employee.id || employee._id;

                return (
                  <option key={id} value={id}>
                    {employee.firstName} {employee.lastName}
                    {employee.position ? ` — ${employee.position}` : ""}
                  </option>
                );
              })}
            </select>

            {employeesLoading && (
              <p className="text-xs text-slate-500 mt-2">
                Loading active employees...
              </p>
            )}
          </div>

          {form.employeeId === "ALL" && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex gap-3">
              <Users className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />

              <div>
                <p className="text-sm font-medium text-indigo-900">
                  Company-wide meeting
                </p>

                <p className="text-xs text-indigo-600 mt-1">
                  Every active employee will see this meeting and can join the
                  same meeting room.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Meeting Title
            </label>

            <input
              name="title"
              required
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Monthly performance discussion"
              className={inputClass}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Meeting Type
            </label>

            <select
              name="type"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
              className={inputClass}
              disabled={loading}
            >
              <option value="ONE_TO_ONE">One-to-One</option>
              <option value="PERFORMANCE">Performance</option>
              <option value="PROJECT">Project</option>
              <option value="HR_DISCUSSION">HR Discussion</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date / Time
              </label>

              <input
                type="datetime-local"
                name="scheduledAt"
                required
                value={form.scheduledAt}
                onChange={(e) => updateField("scheduledAt", e.target.value)}
                min={minDateTime}
                className={inputClass}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Duration
              </label>

              <select
                name="durationMinutes"
                value={form.durationMinutes}
                onChange={(e) => updateField("durationMinutes", e.target.value)}
                className={inputClass}
                disabled={loading}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || employeesLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarDays className="w-4 h-4" />
              )}

              {loading
                ? isEditMode
                  ? "Updating..."
                  : "Scheduling..."
                : isEditMode
                  ? "Update Meeting"
                  : "Schedule Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleMeetingModal;
