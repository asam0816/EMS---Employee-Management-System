import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";

const getInitialNotes = () => ({
  discussion: "",
  issues: "",
  managerComments: "",
});

const getInitialActionItem = () => ({
  text: "",
  dueDate: "",
  completed: false,
});

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const MeetingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");

  const [notes, setNotes] = useState(getInitialNotes);
  const [actionItems, setActionItems] = useState([getInitialActionItem()]);

  const participantLabel = useMemo(() => {
    if (!meeting) return "";

    if (meeting.audience === "ALL") {
      return "All Employees";
    }

    const firstName = meeting.employeeId?.firstName || "";
    const lastName = meeting.employeeId?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || "Unassigned";
  }, [meeting]);

  const participantMeta = useMemo(() => {
    if (!meeting) return "";

    if (meeting.audience === "ALL") {
      return "Company-wide meeting";
    }

    return meeting.employeeId?.position || "";
  }, [meeting]);

  const participants = meeting?.participants || [];
  const activeParticipants = participants.filter((p) => !p.leftAt);

  const fetchMeeting = useCallback(
    async ({ tryStart = false } = {}) => {
      try {
        setError("");

        const { data } = await api.get(`/meetings/${id}`);
        const meetingData = data?.data;

        if (!meetingData) {
          throw new Error("Meeting not found");
        }

        setMeeting(meetingData);

        setNotes({
          discussion: meetingData?.notes?.discussion || "",
          issues: meetingData?.notes?.issues || "",
          managerComments: meetingData?.notes?.managerComments || "",
        });

        if (
          Array.isArray(meetingData?.actionItems) &&
          meetingData.actionItems.length > 0
        ) {
          setActionItems(
            meetingData.actionItems.map((item) => ({
              text: item.text || "",
              dueDate: item.dueDate
                ? new Date(item.dueDate).toISOString().split("T")[0]
                : "",
              completed: Boolean(item.completed),
            })),
          );
        } else {
          setActionItems([getInitialActionItem()]);
        }

        const scheduledTime = new Date(meetingData.scheduledAt).getTime();
        const now = Date.now();

        if (["COMPLETED", "CANCELLED"].includes(meetingData.status)) {
          setWaiting(false);
          setLoading(false);
          return;
        }

        if (now < scheduledTime) {
          setWaiting(true);
          setLoading(false);
          return;
        }

        setWaiting(false);

        if (tryStart && meetingData.status !== "IN_PROGRESS") {
          const startResponse = await api.patch(`/meetings/${id}/start`);
          setMeeting(startResponse?.data?.data || meetingData);
        }
      } catch (err) {
        const message =
          err.response?.data?.error || err.message || "Failed to fetch meeting";

        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await fetchMeeting({ tryStart: true });
    };

    run();

    return () => {
      mounted = false;
    };
  }, [fetchMeeting]);

  useEffect(() => {
    if (!meeting || error) return;

    const timer = setInterval(() => {
      const status = meeting?.status;
      if (["COMPLETED", "CANCELLED"].includes(status)) return;
      fetchMeeting({ tryStart: true });
    }, 15000);

    return () => clearInterval(timer);
  }, [meeting, error, fetchMeeting]);

  const updateActionItem = (index, field, value) => {
    setActionItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const addActionItem = () => {
    setActionItems((prev) => [...prev, getInitialActionItem()]);
  };

  const removeActionItem = (index) => {
    setActionItems((prev) => {
      if (prev.length === 1) return [getInitialActionItem()];
      return prev.filter((_, i) => i !== index);
    });
  };

  const saveNotes = async () => {
    setSaving(true);

    try {
      await api.put(`/meetings/${id}/notes`, {
        ...notes,
        actionItems,
      });

      toast.success("Meeting notes saved");
    } catch (err) {
      toast.error(
        err.response?.data?.error || err.message || "Failed to save notes",
      );
    } finally {
      setSaving(false);
    }
  };

  const endMeeting = async () => {
    try {
      if (!isAdmin) {
        navigate("/meetings");
        return;
      }

      if (waiting) {
        toast.error("Meeting cannot be ended before the scheduled time");
        return;
      }

      if (meeting.status !== "IN_PROGRESS") {
        toast.error("Meeting must be in progress before it can be ended");
        return;
      }

      await saveNotes();
      const { data } = await api.patch(`/meetings/${id}/end`);
      setMeeting(data?.data || meeting);

      toast.success("Meeting ended");
      navigate("/meetings");
    } catch (err) {
      toast.error(
        err.response?.data?.error || err.message || "Failed to end meeting",
      );
    }
  };

  if (loading) return <Loading />;

  if (error && !meeting) {
    return (
      <div className="animate-fade-in">
        <div className="card p-8 max-w-2xl mx-auto mt-10">
          <h2 className="text-xl font-semibold text-rose-600 mb-3">
            Failed to load meeting
          </h2>

          <p className="text-slate-600 mb-6">{error}</p>

          <button onClick={() => navigate("/meetings")} className="btn-primary">
            Back to meetings
          </button>
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  const jitsiRoom = `https://meet.jit.si/${encodeURIComponent(meeting.roomId)}`;
  const isCompleted = meeting.status === "COMPLETED";
  const isCancelled = meeting.status === "CANCELLED";
  const isLive = meeting.status === "IN_PROGRESS";
  const canEditNotes = isAdmin && (isLive || isCompleted);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate("/meetings")}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to meetings
          </button>

          <h1 className="page-title flex items-center gap-2">
            <Video className="w-6 h-6 text-indigo-600" />
            {meeting.title}
          </h1>

          <p className="page-subtitle">
            {participantLabel}
            {participantMeta ? ` • ${participantMeta}` : ""}
          </p>

          <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-500">
            <span>Scheduled: {formatDateTime(meeting.scheduledAt)}</span>
            <span>Duration: {meeting.durationMinutes} min</span>
            <span>Status: {meeting.status}</span>
          </div>
        </div>

        <button
          onClick={endMeeting}
          disabled={waiting || (!isLive && !isCompleted)}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium self-start disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isAdmin ? "End Meeting" : "Leave Meeting"}
        </button>
      </div>

      {waiting && !isCompleted && !isCancelled && (
        <div className="card p-6 mb-6 border border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-900">
            Meeting not started yet
          </h2>
          <p className="text-sm text-amber-700 mt-2">
            This meeting can only be started at its scheduled time.
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Scheduled time: {formatDateTime(meeting.scheduledAt)}
          </p>
        </div>
      )}

      {(isCompleted || isCancelled) && (
        <div className="card p-6 mb-6 border border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-900">
            {isCompleted ? "Meeting completed" : "Meeting cancelled"}
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Meeting details are shown below.
          </p>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        {!waiting && !isCompleted && !isCancelled && (
          <div className="card overflow-hidden">
            <iframe
              src={jitsiRoom}
              title="Meeting Room"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full border-0 bg-slate-950"
              style={{
                height: "70vh",
                minHeight: "560px",
              }}
            />
          </div>
        )}

        {isAdmin && (
          <div className="card p-5 sm:p-6 h-fit">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Participants
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Joined: {activeParticipants.length} / Total:{" "}
                  {participants.length}
                </p>
              </div>
            </div>

            {participants.length > 0 ? (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {participants.map((p) => {
                  const emp = p.employeeId || {};
                  const name =
                    `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
                  const initials =
                    (emp.firstName?.[0] || "") + (emp.lastName?.[0] || "");

                  return (
                    <div
                      key={
                        p._id ||
                        `${p.employeeId?._id || p.employeeId}-${p.joinedAt}`
                      }
                      className="p-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                          {initials || <UserRound className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {name || "Unknown participant"}
                            {emp.position ? ` • ${emp.position}` : ""}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            Joined: {formatDateTime(p.joinedAt)}
                          </p>

                          {p.leftAt ? (
                            <p className="text-xs text-slate-500 mt-1">
                              Left: {formatDateTime(p.leftAt)}
                            </p>
                          ) : (
                            <p className="text-xs text-emerald-600 mt-1">
                              Currently in meeting
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No participation recorded yet.
              </p>
            )}
          </div>
        )}

        {isAdmin && canEditNotes && (
          <div className="card p-5 sm:p-6 h-fit xl:col-start-2">
            <h2 className="font-semibold text-slate-900">Meeting Notes</h2>

            <p className="text-sm text-slate-500 mt-1 mb-5">
              Private manager notes and action items.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Discussion
                </label>

                <textarea
                  rows="3"
                  value={notes.discussion}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      discussion: e.target.value,
                    }))
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Issues
                </label>

                <textarea
                  rows="3"
                  value={notes.issues}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      issues: e.target.value,
                    }))
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Manager Comments
                </label>

                <textarea
                  rows="3"
                  value={notes.managerComments}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      managerComments: e.target.value,
                    }))
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Action Items
                </label>

                <div className="space-y-3">
                  {actionItems.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 border border-slate-200 rounded-xl"
                    >
                      <input
                        value={item.text}
                        placeholder="Action item..."
                        onChange={(e) =>
                          setActionItems((prev) => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              text: e.target.value,
                            };
                            return next;
                          })
                        }
                        className="w-full p-2 border border-slate-200 rounded-lg"
                      />

                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) =>
                          setActionItems((prev) => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              dueDate: e.target.value,
                            };
                            return next;
                          })
                        }
                        className="w-full p-2 border border-slate-200 rounded-lg mt-2"
                      />

                      <div className="flex justify-between items-center mt-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed)}
                            onChange={(e) =>
                              setActionItems((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  completed: e.target.checked,
                                };
                                return next;
                              })
                            }
                          />
                          Completed
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            setActionItems((prev) => {
                              if (prev.length === 1)
                                return [getInitialActionItem()];
                              return prev.filter((_, i) => i !== index);
                            })
                          }
                          className="text-sm text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setActionItems((prev) => [
                        ...prev,
                        getInitialActionItem(),
                      ])
                    }
                    className="btn-secondary text-sm w-full"
                  >
                    + Add Action Item
                  </button>
                </div>
              </div>

              <button
                onClick={saveNotes}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}

                {saving ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRoom;
