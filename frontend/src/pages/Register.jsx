import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (!/\d/.test(form.password)) return toast.error('Password must contain at least one number');
    setLoading(true);
    try {
      await register(form.email, form.username, form.password);
      toast.success('Account created! Check your email to verify 📬');
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.field === 'email') {
        toast.error('That email already has an account — redirecting to login...');
        setTimeout(() => navigate('/login', { state: { email: form.email, fromRegister: true } }), 1200);
      } else if (data?.field === 'username') {
        toast.error('That username is already taken. Try another?');
      } else {
        const msg = data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed';
        toast.error(msg);
      }
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
          <h1 className="text-3xl font-bold text-neutral-900">Orbit</h1>
          <p className="text-stone-500 mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input type="email" placeholder="Email address" value={form.email} onChange={update('email')} required className="input-field pl-9" />
          </div>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input type="text" placeholder="Username (3-20 chars, a-z 0-9 _)" value={form.username} onChange={update('username')} required minLength={3} maxLength={20} className="input-field pl-9" />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input type={showPass ? 'text' : 'password'} placeholder="Password (min 8 chars, 1 number)" value={form.password} onChange={update('password')} required className="input-field pl-9 pr-10" />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-900">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-stone-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-500 hover:text-orange-600 font-semibold">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
