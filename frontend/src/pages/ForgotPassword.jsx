import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, CheckCircle } from 'lucide-react';
import api from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-neutral-900">Forgot Password</h1>
          <p className="text-stone-500 mt-1 text-sm">Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle size={48} className="text-emerald-500" />
            <p className="text-emerald-600 font-semibold">Reset link sent!</p>
            <p className="text-stone-500 text-sm">
              If an account with that email exists, you'll receive a password reset link shortly.
            </p>
            <Link to="/login" className="text-orange-500 hover:text-orange-600 text-sm mt-2">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field pl-9"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <p className="text-center text-stone-500 text-sm">
              Remember your password?{' '}
              <Link to="/login" className="text-orange-500 hover:text-orange-600 font-semibold">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
