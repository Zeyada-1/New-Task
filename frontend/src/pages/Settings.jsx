import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Globe, Lock, User, ShieldCheck,
  Users, CalendarDays, CheckSquare, Flame,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';

const AVATARS = [
  { key: 'warrior', color: '#f97316', label: 'Orange' },
  { key: 'mage',    color: '#3b82f6', label: 'Blue'   },
  { key: 'archer',  color: '#22c55e', label: 'Green'  },
  { key: 'rogue',   color: '#8b5cf6', label: 'Purple' },
];

function Section({ title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <Icon size={13} />
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

function Toggle({ enabled, onToggle, saving }) {
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      aria-label="Toggle"
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-300
        ${enabled ? 'bg-orange-500' : 'bg-stone-200'}
        ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300
          ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const patchSettings = async (data, successMsg) => {
    setSaving(true);
    try {
      await api.patch('/user/settings', data);
      await refreshUser();
      toast.success(successMsg);
    } catch {
      toast.error('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  };

  const handlePrivacyToggle = () =>
    patchSettings(
      { isPublic: !user.isPublic },
      user.isPublic ? 'Account set to private' : 'Account is now public 🌐'
    );

  const handleAvatarChange = (key) => {
    if (key === user.avatar) return;
    patchSettings({ avatar: key }, 'Avatar updated!');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50 border border-orange-200">
          <SettingsIcon size={17} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Settings</h1>
          <p className="text-xs text-stone-500">Manage your account preferences</p>
        </div>
      </div>

      {/* ── Account info ───────────────────────────────────────────────────── */}
      <Section title="Account" icon={User}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: AVATARS.find((a) => a.key === user.avatar)?.color ?? '#6b7280' }}
          >
            {user.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-neutral-900 text-lg">{user.username}</p>
            <p className="text-sm text-stone-500">{user.email}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Member since {new Date(user.createdAt ?? Date.now()).getFullYear()}
            </p>
          </div>
        </div>
      </Section>

      {/* ── Hero / Avatar ──────────────────────────────────────────────────── */}
      <Section title="Profile" icon={User}>
        <div className="grid grid-cols-4 gap-3">
          {AVATARS.map((a) => {
            const isSelected = user.avatar === a.key;
            return (
              <button
                key={a.key}
                onClick={() => handleAvatarChange(a.key)}
                disabled={saving}
                className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all border ${
                  isSelected
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-stone-200 bg-white hover:border-orange-200'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ background: a.color }}
                />
                <span className={`text-xs font-semibold ${isSelected ? 'text-orange-600' : 'text-stone-500'}`}>{a.label}</span>
                {isSelected && (
                  <span className="text-[10px] text-orange-500 font-bold">Active</span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Privacy ────────────────────────────────────────────────────────── */}
      <Section title="Privacy" icon={ShieldCheck}>
        {/* Toggle row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                user.isPublic
                  ? 'bg-emerald-500/15 border border-emerald-500/25'
                  : 'bg-stone-100 border border-stone-200'
              }`}
            >
              {user.isPublic
                ? <Globe size={16} className="text-emerald-500" />
                : <Lock size={16} className="text-stone-400" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {user.isPublic ? 'Public Account' : 'Private Account'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {user.isPublic
                  ? 'Others can find you in search and view your profile'
                  : 'Only you can see your tasks and schedule'}
              </p>
            </div>
          </div>
          <Toggle enabled={user.isPublic} onToggle={handlePrivacyToggle} saving={saving} />
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-stone-100" />

        {/* What public means */}
        <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-3">
          {user.isPublic ? 'When public, others can see:' : 'When public, others will be able to see:'}
        </p>
        <div className="space-y-2">
          {[
            { icon: Users,       label: 'Your profile'                           },
            { icon: CalendarDays,label: 'Your upcoming schedule (next 30 days)'  },
            { icon: Flame,       label: 'Your recently completed tasks'           },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <Icon
                size={13}
                className={user.isPublic ? 'text-emerald-500' : 'text-stone-300'}
              />
              <span className={user.isPublic ? 'text-stone-600' : 'text-stone-400'}>{label}</span>
            </div>
          ))}
        </div>

        {/* Tip when private */}
        {!user.isPublic && (
          <p className="mt-4 text-xs text-stone-400 italic">
            You can still search for and view other public profiles even while your account is private.
          </p>
        )}
      </Section>
    </div>
  );
}
