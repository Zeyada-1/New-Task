import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Lock, Globe, ChevronRight } from 'lucide-react';
import api from '../lib/api';

const AVATAR_COLORS = { warrior: '#f97316', mage: '#3b82f6', archer: '#22c55e', rogue: '#8b5cf6' };

export default function SearchPage() {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => { setResults(res.data); setSearched(true); })
        .catch(() => { setResults([]); setSearched(true); })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50 border border-orange-200"
        >
          <Users size={18} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Find People</h1>
          <p className="text-xs text-stone-500">Search for other users and view their profiles</p>
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="input-field pl-9 w-full"
          autoFocus
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs animate-pulse">
            Searching…
          </span>
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {results.map((u, i) => (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/users/${u.username}`)}
                className="card w-full flex items-center gap-3 p-3 rounded-xl hover:border-orange-200 transition-all text-left group"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base"
                    style={{ background: AVATAR_COLORS[u.avatar] || '#6b7280' }}
                  >
                    {u.username?.[0]?.toUpperCase() || '?'}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-900">{u.username}</span>
                    {u.isPublic
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full text-emerald-600 bg-emerald-50 border border-emerald-200 flex items-center gap-0.5">
                          <Globe size={9} /> Public
                        </span>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded-full text-stone-400 bg-stone-100 border border-stone-200 flex items-center gap-0.5">
                          <Lock size={9} /> Private
                        </span>
                    }
                  </div>

                </div>

                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-400 transition-colors flex-shrink-0" />
              </motion.button>
            ))}
          </motion.div>
        )}

        {searched && !loading && results.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Users size={36} className="mx-auto mb-3 text-stone-300" />
            <p className="text-stone-400">
              No users found for "<span className="text-stone-600">{query}</span>"
            </p>
          </motion.div>
        )}

        {!searched && !loading && (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Search size={40} className="mx-auto mb-3 text-stone-200" />
            <p className="text-stone-400 text-sm">Type at least 2 characters to search</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
