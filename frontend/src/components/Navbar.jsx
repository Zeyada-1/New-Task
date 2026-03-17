import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, CheckSquare, BarChart2, CalendarDays, Users, Settings, LogOut, Atom, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks',     label: 'Tasks',     icon: CheckSquare     },
  { to: '/calendar',  label: 'Schedule',  icon: CalendarDays    },
  { to: '/analytics', label: 'Analytics', icon: BarChart2       },
  { to: '/orbit',     label: 'Orbit',     icon: Atom            },
  { to: '/search',    label: 'People',    icon: Users           },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, setDark } = useTheme();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (resending || resent) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      setResent(true);
      toast.success('Verification email sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resend email');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <>
    <nav className={`border-b sticky top-0 z-40 px-4 py-3 transition-colors duration-300 ${
      dark ? 'bg-[#1c1917] border-[#292524]' : 'bg-white border-stone-200'
    }`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Orbit" className="w-7 h-7" />
          <span className={`font-bold text-lg ${dark ? 'text-stone-100' : 'text-neutral-900'}`}>Orbit</span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-50 text-orange-600'
                    : dark
                      ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                      : 'text-stone-500 hover:text-neutral-900 hover:bg-stone-100'
                }`
              }
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className={`font-medium ${dark ? 'text-stone-300' : 'text-stone-700'}`}>{user.username}</span>
            </div>
          )}
          {/* Dark/Light toggle */}
          <button
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`flex items-center p-1.5 rounded-lg transition-colors cursor-pointer ${
              dark ? 'text-stone-400 hover:text-yellow-300' : 'text-stone-400 hover:text-neutral-900'
            }`}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center p-1.5 rounded-lg transition-colors ${
                isActive ? 'text-orange-500' : dark ? 'text-stone-400 hover:text-stone-100' : 'text-stone-400 hover:text-neutral-900'
              }`
            }
            title="Settings"
          >
            <Settings size={16} />
          </NavLink>
          <button onClick={handleLogout} aria-label="Log out" className="flex items-center gap-1.5 text-stone-400 hover:text-red-500 transition-colors text-sm">
            <LogOut size={15} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
    {user && !user.emailVerified && (
      <div className="px-4 py-2 text-center flex items-center justify-center gap-3 flex-wrap text-sm bg-amber-50 border-b border-amber-200">
        <span className="text-amber-700">📬 Please verify your email address to secure your account.</span>
        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="text-xs font-semibold text-amber-600 hover:text-amber-800 underline disabled:opacity-50"
        >
          {resent ? 'Sent! ✓' : resending ? 'Sending...' : 'Resend verification'}
        </button>
      </div>
    )}
  </>
  );
}
