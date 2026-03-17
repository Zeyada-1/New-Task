import { useAuth } from '../context/AuthContext';
import { Flame, CheckCircle } from 'lucide-react';

const AVATAR_COLORS = { warrior: '#f97316', mage: '#3b82f6', archer: '#22c55e', rogue: '#8b5cf6' };

export default function HeroCard() {
  const { user } = useAuth();
  if (!user) return null;

  const avatarColor = AVATAR_COLORS[user.avatar] || '#6b7280';
  const initial = user.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ background: avatarColor }}
        >
          {initial}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-neutral-900 text-lg truncate">{user.username}</h2>
          <p className="text-stone-500 text-sm">Member</p>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-2 text-right flex-shrink-0">
          <div className="flex items-center gap-1 justify-end text-orange-500">
            <Flame size={14} />
            <span className="text-sm font-bold">{user.streak}d</span>
          </div>
          <div className="flex items-center gap-1 justify-end text-emerald-500">
            <CheckCircle size={14} />
            <span className="text-sm font-bold">{user.completedCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
