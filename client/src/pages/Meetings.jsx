import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";

import MeetingCard from "../components/meeting/MeetingCard";
import ScheduleMeetingModal from "../components/meeting/ScheduleMeetingModal";

const COMPLETED_STATUSES = ["COMPLETED", "DECLINED", "CANCELLED"];

const Meetings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "ADMIN";

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);

  const fetchMeetings = useCallback(async () => {
    try {
      const { data } = await api.get("/meetings");
      setMeetings(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to fetch meetings",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const respond = async (id, status) => {
    try {
      await api.patch(`/meetings/${id}/respond`, { status });

      toast.success(
        status === "ACCEPTED" ? "Meeting accepted" : "Meeting declined",
      );

      fetchMeetings();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to update meeting",
      );
    }
  };

  const join = (id) => {
    // "View / Join" both open the meeting room page
    navigate(`/meetings/${id}`);
  };

  const handleCreate = () => {
    setEditingMeeting(null);
    setShowSchedule(true);
  };

  const handleEdit = (meeting) => {
    setEditingMeeting(meeting);
    setShowSchedule(true);
  };

  const handleDelete = async (meeting) => {
    const confirmDelete = window.confirm(
      `Delete meeting "${meeting.title}"? This cannot be undone.`,
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/meetings/${meeting.id}`);
      toast.success("Meeting deleted");
      fetchMeetings();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to delete meeting",
      );
    }
  };

  const closeModal = () => {
    setShowSchedule(false);
    setEditingMeeting(null);
  };

  const categorizedMeetings = useMemo(() => {
    const now = Date.now();

    const normalized = meetings.map((meeting) => {
      const scheduledAtTs = new Date(meeting.scheduledAt).getTime();

      const participantsCount =
        meeting.participantsCount ??
        (Array.isArray(meeting.participants) ? meeting.participants.length : 0);

      const canJoinNow =
        scheduledAtTs <= now && !COMPLETED_STATUSES.includes(meeting.status);

      return {
        ...meeting,
        scheduledAtTs,
        participantsCount,
        canJoinNow,
      };
    });

    const upcoming = normalized
      .filter(
        (meeting) =>
          !COMPLETED_STATUSES.includes(meeting.status) &&
          meeting.status !== "IN_PROGRESS" &&
          meeting.scheduledAtTs > now,
      )
      .sort((a, b) => a.scheduledAtTs - b.scheduledAtTs);

    const live = normalized
      .filter(
        (meeting) =>
          meeting.status === "IN_PROGRESS" ||
          (!COMPLETED_STATUSES.includes(meeting.status) &&
            meeting.scheduledAtTs <= now),
      )
      .sort((a, b) => a.scheduledAtTs - b.scheduledAtTs);

    const completed = normalized
      .filter((meeting) => COMPLETED_STATUSES.includes(meeting.status))
      .sort((a, b) => b.scheduledAtTs - a.scheduledAtTs);

    return {
      upcoming,
      live,
      completed,
    };
  }, [meetings]);

  const totalParticipants = useMemo(() => {
    return meetings.reduce((sum, meeting) => {
      const count =
        meeting.participantsCount ??
        (Array.isArray(meeting.participants) ? meeting.participants.length : 0);

      return sum + count;
    }, 0);
  }, [meetings]);

  const stats = useMemo(() => {
    return {
      upcoming: categorizedMeetings.upcoming.length,
      live: categorizedMeetings.live.length,
      completed: categorizedMeetings.completed.length,
      total: meetings.length,
      participants: totalParticipants,
    };
  }, [categorizedMeetings, meetings.length, totalParticipants]);

  const Section = ({ title, count, emptyText, items }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>

        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {count}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              isAdmin={isAdmin}
              onRespond={respond}
              onJoin={join}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Video className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{emptyText}</p>
        </div>
      )}
    </div>
  );

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Video className="w-6 h-6 text-indigo-600" />
            Meetings
          </h1>

          <p className="page-subtitle">
            {isAdmin
              ? "Schedule and manage private employee meetings"
              : "View and join your scheduled meetings"}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <CalendarPlus className="w-4 h-4" />
            Schedule Meeting
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {stats.total}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs text-slate-500">Upcoming</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">
            {stats.upcoming}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs text-slate-500">Live</p>
          <p className="text-2xl font-semibold text-emerald-600 mt-1">
            {stats.live}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-2xl font-semibold text-slate-700 mt-1">
            {stats.completed}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs text-slate-500">Participants</p>
          <p className="text-2xl font-semibold text-indigo-600 mt-1">
            {stats.participants}
          </p>
        </div>
      </div>

      <div className="space-y-10">
        <Section
          title="Upcoming Meetings"
          count={stats.upcoming}
          emptyText="No upcoming meetings found."
          items={categorizedMeetings.upcoming}
        />

        <Section
          title="Live Meetings"
          count={stats.live}
          emptyText="No live meetings right now."
          items={categorizedMeetings.live}
        />

        <Section
          title="Completed / Past Meetings"
          count={stats.completed}
          emptyText="No completed meetings found."
          items={categorizedMeetings.completed}
        />
      </div>

      <ScheduleMeetingModal
        open={showSchedule}
        onClose={closeModal}
        onSuccess={fetchMeetings}
        meeting={editingMeeting}
      />
    </div>
  );
};

export default Meetings;
