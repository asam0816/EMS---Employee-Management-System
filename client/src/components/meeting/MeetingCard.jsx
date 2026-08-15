import { CalendarDays, Clock, Edit2, Eye, Trash2, Video } from "lucide-react";

const MeetingCard = ({
  meeting,
  isAdmin,
  onJoin,
  onRespond,
  onEdit,
  onDelete,
}) => {
  const employee = meeting.employeeId;

  const statusColors = {
    SCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
    ACCEPTED: "bg-blue-50 text-blue-700 border-blue-200",
    IN_PROGRESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
    DECLINED: "bg-rose-50 text-rose-700 border-rose-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const scheduledTime = new Date(meeting.scheduledAt).getTime();

  const canJoinNow =
    scheduledTime <= Date.now() &&
    !["DECLINED", "CANCELLED", "COMPLETED"].includes(meeting.status);

  const canEdit =
    isAdmin &&
    scheduledTime > Date.now() &&
    !["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(meeting.status);

  const canDelete =
    isAdmin &&
    scheduledTime > Date.now() &&
    !["IN_PROGRESS", "COMPLETED"].includes(meeting.status);

  const participantCount =
    meeting.participantsCount ||
    (Array.isArray(meeting.participants) ? meeting.participants.length : 0);

  const participantLabel =
    meeting.audience === "ALL"
      ? "All Employees"
      : `${employee?.firstName || ""} ${employee?.lastName || ""}${
          employee?.position ? ` • ${employee.position}` : ""
        }`.trim() || "Unassigned";

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{meeting.title}</h3>

            <span
              className={`px-2 py-1 rounded-lg border text-xs ${
                statusColors[meeting.status] || ""
              }`}
            >
              {meeting.status}
            </span>

            {meeting.audience === "ALL" && (
              <span className="px-2 py-1 rounded-lg border text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                Company-wide
              </span>
            )}

            <span className="px-2 py-1 rounded-lg border text-xs bg-slate-50 text-slate-700 border-slate-200">
              Participants: {participantCount}
            </span>
          </div>

          <p className="text-sm text-slate-500 mt-2">{participantLabel}</p>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500 mt-4">
            <span className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {new Date(meeting.scheduledAt).toLocaleString()}
            </span>

            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {meeting.durationMinutes} min
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* View details / participants */}
          <button
            type="button"
            onClick={() => onJoin(meeting.id)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm"
          >
            <Eye className="w-4 h-4" />
            View
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => onEdit?.(meeting)}
                disabled={!canEdit}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  canEdit
                    ? "Edit meeting"
                    : "Only future scheduled meetings can be edited"
                }
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>

              <button
                type="button"
                onClick={() => onDelete?.(meeting)}
                disabled={!canDelete}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  canDelete
                    ? "Delete meeting"
                    : "Only future scheduled meetings can be deleted"
                }
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}

          {!isAdmin &&
            meeting.status === "SCHEDULED" &&
            meeting.audience !== "ALL" && (
              <>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => onRespond(meeting.id, "DECLINED")}
                >
                  Decline
                </button>

                <button
                  className="btn-primary text-sm"
                  onClick={() => onRespond(meeting.id, "ACCEPTED")}
                >
                  Accept
                </button>
              </>
            )}

          {!["DECLINED", "CANCELLED"].includes(meeting.status) && (
            <button
              onClick={() => onJoin(meeting.id)}
              disabled={!canJoinNow}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              title={
                canJoinNow
                  ? "Join meeting"
                  : "Meeting can start only at the scheduled time"
              }
            >
              <Video className="w-4 h-4" />
              {canJoinNow ? "Join" : "Starts later"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingCard;
