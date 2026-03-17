import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const location = useLocation();
  const fromRegister = location.state?.fromRegister ?? false;
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
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
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.svg" alt="Orbit" className="w-12 h-12 mb-3" />
          <h1 className="text-3xl font-bold text-neutral-900">Orbit</h1>
          <p className="text-stone-500 mt-1">Stay on top of your tasks</p>
        </div>

        {fromRegister && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-amber-700 flex items-start gap-2 bg-amber-50 border border-amber-200">
            <span className="mt-0.5">⚠</span>
            <span>An account with this email already exists. Enter your password to sign in.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field pl-9 pr-10"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-900">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div className="text-center mt-2">
            <Link to="/forgot-password" className="text-stone-500 hover:text-orange-500 text-sm">
              Forgot your password?
            </Link>
          </div>
        </form>

        <p className="text-center text-stone-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-orange-500 hover:text-orange-600 font-semibold">
            Create account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
