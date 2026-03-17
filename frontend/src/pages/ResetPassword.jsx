import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (!/\d/.test(password)) return toast.error('Password must include at least one number');
    if (password !== confirm) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3]">
        <div className="text-center">
          <p className="text-red-500 mb-4">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-orange-500 hover:text-orange-600">
            Request a new one
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card p-8 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.svg" alt="Orbit" className="w-12 h-12 mb-3" />
          <h1 className="text-2xl font-bold text-neutral-900">Reset Password</h1>
          <p className="text-stone-500 mt-1 text-sm">Enter your new password below</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle size={48} className="text-emerald-500" />
            <p className="text-emerald-600 font-semibold text-lg">Password reset!</p>
            <p className="text-stone-500 text-sm">Your password has been updated successfully.</p>
            <button onClick={() => navigate('/login')} className="btn-primary px-6 py-2.5 mt-2">
              Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="New password (min 8 chars, 1 number)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-900"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="input-field pl-9"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
