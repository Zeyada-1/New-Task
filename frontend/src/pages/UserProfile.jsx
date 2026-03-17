import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Lock, Globe,
  Calendar, CheckCircle, Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const AVATAR_COLORS = { warrior: '#f97316', mage: '#3b82f6', archer: '#22c55e', rogue: '#8b5cf6' };
const PRIORITY_COLORS = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isOwn = me?.username === username;

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/users/${username}`)
      .then((res) => {
        setProfile(res.data);
        return api.get(`/users/${username}/schedule`);
      })
      .then((res) => setSchedule(res.data))
      .catch((err) => {
        // 403 on schedule means private (but profile still loaded)
        if (err.response?.status === 404) setError('User not found');
        else if (err.response?.status !== 403) setError('Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, [username]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-stone-400 animate-pulse">Loading profile…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <Users size={40} className="mx-auto mb-3 text-stone-300" />
        <p className="text-stone-500 mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary">Go back</button>
      </div>
    );
  }

  const canSeeFull = profile.isPublic || isOwn;

  // Group upcoming tasks by calendar day
  const groupedUpcoming = {};
  (schedule?.upcoming || []).forEach((task) => {
    const key = new Date(task.dueDate).toDateString();
    if (!groupedUpcoming[key]) groupedUpcoming[key] = [];
    groupedUpcoming[key].push(task);
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-stone-500 hover:text-neutral-900 transition-colors text-sm"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Profile header ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5"
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
              style={{ background: AVATAR_COLORS[profile.avatar] || '#6b7280' }}
            >
              {profile.username?.[0]?.toUpperCase() || '?'}
            </div>
          </div>

          {/* Text info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-neutral-900 text-xl">{profile.username}</h1>
              {profile.isPublic
                ? <span className="text-[10px] px-2 py-0.5 rounded-full text-emerald-600 bg-emerald-50 border border-emerald-200 flex items-center gap-0.5">
                    <Globe size={9} /> Public
                  </span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full text-stone-500 bg-stone-100 border border-stone-200 flex items-center gap-0.5">
                    <Lock size={9} /> Private
                  </span>
              }
            </div>
            <p className="text-stone-500 text-sm mt-0.5">
              Member · Joined {fmtDate(profile.joinedAt)}
            </p>
          </div>

          {/* Right stats */}
          <div className="flex items-center gap-1 justify-end text-emerald-500 flex-shrink-0">
            <CheckCircle size={13} />
            <span className="text-sm font-bold">{profile.completedCount} completed</span>
          </div>
        </div>

        {/* Settings link for own profile */}
        {isOwn && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <a
              href="/settings"
              className="text-xs text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1"
            >
              ⚙ Manage privacy &amp; avatar in Settings
            </a>
          </div>
        )}
      </motion.div>

      {/* ── Private account wall ─────────────────────────────────────────── */}
      {!canSeeFull && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-10 text-center"
        >
          <Lock size={36} className="mx-auto mb-3 text-stone-300" />
          <h3 className="text-neutral-900 font-semibold mb-1">Private Account</h3>
          <p className="text-stone-500 text-sm">This user has chosen to keep their tasks private.</p>
        </motion.div>
      )}



      {/* ── Upcoming schedule ────────────────────────────────────────────── */}
      {canSeeFull && schedule && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={13} /> Upcoming Schedule (next 30 days)
          </h2>

          {Object.keys(groupedUpcoming).length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-4">No upcoming tasks in the next 30 days.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedUpcoming).map(([, tasks]) => (
                <div key={tasks[0].dueDate}>
                  <p className="text-xs font-semibold text-orange-500 mb-1.5">{fmtDate(tasks[0].dueDate)}</p>
                  <div className="space-y-1.5 pl-3 border-l-2 border-orange-100">
                    {tasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: PRIORITY_COLORS[t.priority] ?? '#e5e3de' }}
                          />
                          <span className="text-neutral-900 truncate">{t.title}</span>
                          <span className="text-xs text-stone-400 flex-shrink-0 hidden sm:block">{t.category}</span>
                        </div>
                        <span className="text-xs text-stone-400 flex-shrink-0">{fmtTime(t.dueDate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Recent completions ───────────────────────────────────────────── */}
      {canSeeFull && schedule?.recent?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5"
        >
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CheckCircle size={13} /> Recently Completed
          </h2>
          <div className="divide-y divide-stone-100">
            {schedule.recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-neutral-900 truncate">{t.title}</span>
                  <span className="text-xs text-stone-400 flex-shrink-0 hidden sm:block">{t.category}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-stone-400">{fmtDate(t.completedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
