import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card p-8 w-full max-w-md text-center"
      >
        <img src="/favicon.svg" alt="Orbit" className="w-12 h-12 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Email Verification</h1>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader size={40} className="text-orange-400 animate-spin" />
            <p className="text-stone-500">Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle size={48} className="text-emerald-500" />
            <p className="text-emerald-600 font-semibold text-lg">Email verified!</p>
            <p className="text-stone-500 text-sm">{message}</p>
            <Link to="/" className="btn-primary px-6 py-2.5 inline-block mt-2">
              Go to Dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle size={48} className="text-red-400" />
            <p className="text-red-500 font-semibold text-lg">Verification failed</p>
            <p className="text-stone-500 text-sm">{message}</p>
            <Link to="/" className="text-orange-500 hover:text-orange-600 text-sm mt-2">
              Back to app
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
