import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api from '../lib/api';
import { CheckCircle, Target, ListTodo, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const PRIO_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
const CATEGORY_COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function CustomTooltip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: dark ? '#292524' : '#ffffff',
      border: `1px solid ${dark ? '#44403c' : '#e5e3de'}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 13,
    }}>
      <p style={{ color: dark ? '#a8a29e' : '#78716c', marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [tasksHistory, setTasksHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { dark } = useTheme();

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/tasks-history'),
    ]).then(([ov, th]) => {
      setOverview(ov.data);
      setTasksHistory(th.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-stone-400 animate-pulse py-24">Crunching your stats...</div>;

  const priorityPieData = overview ? [
    { name: 'Low', value: overview.byPriority.LOW, color: PRIO_COLORS.LOW },
    { name: 'Medium', value: overview.byPriority.MEDIUM, color: PRIO_COLORS.MEDIUM },
    { name: 'High', value: overview.byPriority.HIGH, color: PRIO_COLORS.HIGH },
  ].filter((d) => d.value > 0) : [];

  const historyHasData = tasksHistory.some((d) => d.count > 0);

  // chart theme tokens
  const gridColor  = dark ? '#3a3532' : '#e5e3de';
  const tickColor  = dark ? '#78716c' : '#a3a3a3';
  const tooltipBg  = dark ? '#292524' : '#ffffff';
  const tooltipBorder = dark ? '#44403c' : '#e5e3de';

  const topStats = [
    { icon: ListTodo,    label: 'Total Tasks',      value: overview?.total ?? 0,              color: '#3b82f6' },
    { icon: CheckCircle, label: 'Completed',         value: overview?.completed ?? 0,           color: '#10b981' },
    { icon: Clock,       label: 'Pending',           value: overview?.pending ?? 0,             color: '#f59e0b' },
    { icon: Target,      label: 'Completion Rate',   value: `${overview?.completionRate ?? 0}%`, color: '#f97316' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {topStats.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold text-neutral-900">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Completion progress bar */}
      {(overview?.total ?? 0) > 0 && (
        <div className="glass p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-neutral-900">Overall Progress</span>
            <span className="text-stone-500">{overview.completed} / {overview.total} tasks done</span>
          </div>
          <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overview.completionRate}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #10b981, #34d399)' }}
            />
          </div>
          <div className="flex justify-between text-xs text-stone-400 mt-1.5">
            <span>{overview.completionRate}% complete</span>
            <span>{overview.pending} remaining</span>
          </div>
        </div>
      )}

      {/* Tasks Completed Over Time */}
      <div className="glass p-5">
        <h3 className="font-bold text-neutral-900 mb-1 flex items-center gap-2">
          <CheckCircle size={18} className="text-emerald-500" /> Tasks Completed (Last 30 Days)
        </h3>
        {!historyHasData ? (
          <div className="text-center text-stone-400 py-10 text-sm">No completions recorded in the last 30 days</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tasksHistory} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip dark={dark} />} />
              <Bar dataKey="count" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Row: Priority Pie + Category Bars */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Priority Pie */}
        <div className="glass p-5">
          <h3 className="font-bold text-neutral-900 mb-4">Completed by Priority</h3>
          {priorityPieData.length === 0 ? (
            <div className="text-center text-stone-400 py-8 text-sm">No completed tasks yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={priorityPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {priorityPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [val, name]}
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 13 }}
                    labelStyle={{ color: tickColor }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-3">
                {priorityPieData.map((p) => (
                  <div key={p.name} className="flex items-center gap-1.5 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-stone-500">{p.name} ({p.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top Categories */}
        <div className="glass p-5">
          <h3 className="font-bold text-neutral-900 mb-1">Completed by Category</h3>
          <p className="text-xs text-stone-400 mb-4">Tasks finished per category</p>
          {!overview?.byCategory?.length ? (
            <div className="text-center text-stone-400 py-8 text-sm">No completed tasks yet</div>
          ) : (
            <div className="space-y-3">
              {overview.byCategory.slice(0, 6).map((cat, i) => {
                const max = overview.byCategory[0].count;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-stone-700">{cat.name || 'General'}</span>
                      <span className="font-semibold" style={{ color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}>
                        {cat.count} done
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: dark ? '#3a3532' : '#f3f2ef' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.count / max) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

