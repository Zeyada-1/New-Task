import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Circle, Clock, Tag, X,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isToday(date) {
  return isSameDay(date, new Date());
}

// Returns Monday-Sunday week containing `date`
function getWeekDays(date) {
  const d = new Date(date);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + i);
    return nd;
  });
}

// Returns day-grid cells for the month (Monday-based, up to 6 rows)
function getMonthGrid(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - startOffset);
  return Array.from({ length: totalCells }, (_, i) => {
    const nd = new Date(start);
    nd.setDate(nd.getDate() + i);
    return nd;
  });
}

// Groups tasks by local date key, sorts within each day by time
function groupByDate(tasks) {
  const map = {};
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const k = dateKey(new Date(t.dueDate));
    if (!map[k]) map[k] = [];
    map[k].push(t);
  }
  for (const k in map) {
    map[k].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }
  return map;
}

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtShortDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtMonthYear(date) {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

const PRIO = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Shared task pill ──────────────────────────────────────────────────────────

function TaskPill({ task, onComplete, showTime = true }) {
  const color = task.color || PRIO[task.priority] || PRIO.MEDIUM;
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all group"
      style={{ background: `${color}18`, borderLeft: `3px solid ${task.completed ? '#475569' : color}` }}
    >
      <button
        onClick={() => !task.completed && onComplete(task)}
        className="flex-shrink-0"
        title={task.completed ? 'Completed' : 'Mark complete'}
      >
        {task.completed
          ? <CheckCircle2 size={12} className="text-emerald-500" />
          : <Circle size={12} className="text-stone-400 group-hover:text-orange-500 transition-colors" />}
      </button>
      <span className={`flex-1 truncate font-medium ${task.completed ? 'line-through text-stone-400' : 'text-neutral-900'}`}>
        {task.title}
      </span>
      {showTime && (
        <span className="text-stone-400 flex-shrink-0 flex items-center gap-0.5">
          <Clock size={9} />
          {fmtTime(task.dueDate)}
        </span>
      )}
    </div>
  );
}

// ── Agenda view ───────────────────────────────────────────────────────────────

function AgendaView({ tasks, tasksByDate, currentDate, onComplete }) {
  const days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [currentDate]);

  const noDateTasks = tasks.filter((t) => !t.dueDate && !t.completed);
  const daysWithTasks = days.filter((d) => (tasksByDate[dateKey(d)] || []).length > 0);

  return (
    <div className="space-y-3">
      {noDateTasks.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-3 font-semibold uppercase tracking-wider">
            <Tag size={12} />
            No Due Date
          </div>
          <div className="space-y-1">
            {noDateTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm text-stone-500 py-1">
                <Circle size={12} className="text-stone-300 flex-shrink-0" />
                <span className="truncate">{t.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                  style={{ background: `${PRIO[t.priority]}18`, color: PRIO[t.priority] }}>
                  {t.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {daysWithTasks.length === 0 && noDateTasks.length === 0 && (
        <div className="card p-12 text-center text-stone-400">
          No tasks scheduled in the next 30 days.
        </div>
      )}

      {daysWithTasks.map((day) => {
        const k = dateKey(day);
        const dayTasks = tasksByDate[k] || [];
        return (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4"
          >
            <div className={`flex items-center gap-3 mb-3 ${isToday(day) ? 'text-orange-600' : 'text-neutral-900'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                ${isToday(day) ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-700'}`}>
                {day.getDate()}
              </div>
              <div>
                <div className="font-semibold text-sm">{fmtShortDate(day)}</div>
                {isToday(day) && (
                  <div className="text-xs text-orange-500">Today</div>
                )}
              </div>
              <div className="ml-auto text-xs text-stone-400">
                {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="space-y-1.5">
              {dayTasks.map((t) => (
                <TaskPill key={t.id} task={t} onComplete={onComplete} />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({ tasksByDate, currentDate, onComplete }) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  return (
    <div className="card overflow-x-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-stone-100 min-w-[560px]">
        {weekDays.map((d, i) => (
          <div
            key={i}
            className={`p-3 text-center border-r border-stone-100 last:border-r-0
              ${isToday(d) ? 'bg-orange-50' : ''}`}
          >
            <div className="text-xs text-stone-400 font-semibold uppercase">{DAY_NAMES[i]}</div>
            <div
              className={`text-xl font-bold mt-0.5 mx-auto w-9 h-9 flex items-center justify-center rounded-full
                ${isToday(d) ? 'bg-orange-500 text-white' : 'text-neutral-900'}`}
            >
              {d.getDate()}
            </div>
            <div className="text-xs text-stone-300 mt-0.5">
              {d.toLocaleDateString([], { month: 'short' })}
            </div>
          </div>
        ))}
      </div>

      {/* Task cells */}
      <div className="grid grid-cols-7 min-w-[560px]">
        {weekDays.map((d, i) => {
          const k = dateKey(d);
          const dayTasks = tasksByDate[k] || [];
          return (
            <div
              key={i}
              className={`min-h-36 p-2 border-r border-stone-100 last:border-r-0
                ${isToday(d) ? 'bg-orange-50/50' : ''}`}
            >
              {dayTasks.length === 0 ? (
                <div className="text-xs text-stone-200 text-center pt-4">—</div>
              ) : (
                <div className="space-y-1">
                  {dayTasks.map((t) => (
                    <TaskPill key={t.id} task={t} onComplete={onComplete} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({ tasksByDate, currentDate, onComplete }) {
  const [selected, setSelected] = useState(null);
  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const currentMonth = currentDate.getMonth();

  const selectedTasks = selected ? (tasksByDate[dateKey(selected)] || []) : [];

  return (
    <div>
      <div className="card overflow-hidden">
        {/* Day name header */}
        <div className="grid grid-cols-7 border-b border-stone-100">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold text-stone-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7">
          {grid.map((d, i) => {
            const k = dateKey(d);
            const dayTasks = tasksByDate[k] || [];
            const inMonth = d.getMonth() === currentMonth;
            const sel = selected && isSameDay(d, selected);
            return (
              <div
                key={i}
                onClick={() => setSelected(sel ? null : d)}
                className={`min-h-[90px] p-1.5 border-r border-b border-stone-100 cursor-pointer transition-colors
                  ${inMonth ? '' : 'opacity-25'}
                  ${isToday(d) ? 'bg-orange-50' : 'hover:bg-stone-50'}
                  ${sel ? 'bg-orange-50 ring-1 ring-inset ring-orange-300/50' : ''}`}
              >
                <div
                  className={`w-7 h-7 flex items-center justify-center text-sm font-semibold rounded-full mb-1
                    ${isToday(d) ? 'bg-orange-500 text-white' : 'text-stone-600'}`}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => {
                    const pillColor = t.color || PRIO[t.priority];
                    return (
                      <div
                        key={t.id}
                        className="truncate text-xs px-1 py-0.5 rounded font-medium"
                        style={{
                          background: `${pillColor}20`,
                          color: t.completed ? '#64748b' : pillColor,
                          textDecoration: t.completed ? 'line-through' : 'none',
                        }}
                      >
                        {t.title}
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-stone-400 px-1">+{dayTasks.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day agenda panel */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={dateKey(selected)}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="card overflow-hidden mt-4"
          >
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-stone-100">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0
                ${isToday(selected) ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-700'}`}>
                {selected.getDate()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-neutral-900">
                  {selected.toLocaleDateString([], { weekday: 'long' })}
                </div>
                <div className="text-sm text-stone-500">
                  {selected.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedTasks.length > 0 && (
                  <span className="text-xs text-stone-400">
                    {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button onClick={() => setSelected(null)}
                  className="text-stone-400 hover:text-neutral-900 transition-colors p-1 rounded-lg hover:bg-stone-100">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              {selectedTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-stone-400">
                  <CalendarDays size={28} className="text-stone-300" />
                  <p className="text-sm">No tasks scheduled for this day.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedTasks.map((t) => (
                    <TaskPill key={t.id} task={t} onComplete={onComplete} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Year view ─────────────────────────────────────────────────────────────────

function YearView({ tasksByDate, currentDate, onSelectMonth }) {
  const year = currentDate.getFullYear();
  const today = new Date();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, mi) => {
        const daysInMonth = new Date(year, mi + 1, 0).getDate();
        const firstDow = new Date(year, mi, 1).getDay();
        const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Monday-based
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === mi;

        return (
          <div key={mi} onClick={() => onSelectMonth(mi)}
            className="card p-3 cursor-pointer transition-all hover:ring-2 hover:ring-orange-400/40 hover:shadow-md">
            <div
              className={`text-sm font-bold mb-2 ${isCurrentMonth ? 'text-orange-500' : 'text-neutral-900'}`}
            >
              {MONTH_NAMES[mi]}
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dn, dni) => (
                <div key={dni} className="text-center text-stone-400" style={{ fontSize: '8px' }}>
                  {dn}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: startOffset }, (_, i) => (
                <div key={`e${i}`} style={{ width: 16, height: 16 }} />
              ))}
              {Array.from({ length: daysInMonth }, (_, di) => {
                const day = di + 1;
                const k = `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const count = (tasksByDate[k] || []).length;
                const isThisToday = today.getFullYear() === year && today.getMonth() === mi && today.getDate() === day;
                const dotColor = tasksByDate[k]?.[0]?.color || '#f97316';

                return (
                  <div
                    key={day}
                    style={{ width: 16, height: 16, position: 'relative' }}
                    title={count > 0 ? `${count} task${count !== 1 ? 's' : ''}` : String(day)}
                  >
                    <div style={{
                      textAlign: 'center',
                      fontSize: '8px',
                      lineHeight: '16px',
                      color: isThisToday ? '#f97316' : '#a8a29e',
                      fontWeight: isThisToday ? 700 : 400,
                    }}>
                      {day}
                    </div>
                    {count > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 1,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: dotColor,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Calendar page ────────────────────────────────────────────────────────

const VIEWS = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'week',   label: 'Week'   },
  { key: 'month',  label: 'Month'  },
  { key: 'year',   label: 'Year'   },
];

export default function Calendar() {
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { dark } = useTheme();

  useEffect(() => {
    api.get('/tasks').then((r) => {
      setTasks(r.data);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load tasks');
      setLoading(false);
    });
  }, []);

  const tasksByDate = useMemo(() => groupByDate(tasks), [tasks]);

  const handleComplete = async (task) => {
    try {
      const res = await api.patch(`/tasks/${task.id}/complete`);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...res.data.task } : t));
      toast.success('Task completed!');
    } catch {
      toast.error('Failed to complete task');
    }
  };

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === 'week')  d.setDate(d.getDate() + dir * 7);
    else if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'year')  d.setFullYear(d.getFullYear() + dir);
    else d.setDate(d.getDate() + dir * 30); // agenda
    setCurrentDate(d);
  };

  const getTitle = () => {
    if (view === 'year') return String(currentDate.getFullYear());
    if (view === 'agenda') {
      return `Agenda · ${currentDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (view === 'week') {
      const [first, , , , , , last] = getWeekDays(currentDate);
      if (first.getMonth() === last.getMonth()) {
        return `${first.toLocaleDateString([], { month: 'long' })} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`;
      }
      return `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return fmtMonthYear(currentDate);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-stone-400 animate-pulse text-lg">Loading schedule...</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <CalendarDays size={24} className="text-orange-500" />
              Schedule
            </h1>
            <p className="text-stone-500 text-sm mt-0.5">Your tasks across time</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View selector */}
            <div
              className="flex rounded-xl overflow-hidden p-0.5 gap-0.5"
              style={dark
                ? { background: '#292524', border: '1px solid #44403c' }
                : { background: '#f3f2ef', border: '1px solid #e5e3de' }}
            >
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    view === v.key
                      ? 'bg-orange-500 text-white shadow-sm'
                      : dark
                        ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-700'
                        : 'text-stone-500 hover:text-neutral-900'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(-1)}
                className="card p-2 rounded-xl text-stone-500 hover:text-neutral-900 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="card px-3 py-1.5 text-sm text-stone-500 hover:text-neutral-900 transition-colors rounded-xl"
              >
                Today
              </button>
              <button
                onClick={() => navigate(1)}
                className="card p-2 rounded-xl text-stone-500 hover:text-neutral-900 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Current period label */}
        <div className="text-neutral-900 font-semibold mb-4 text-lg">{getTitle()}</div>

        {/* View content */}
        <motion.div
          key={`${view}-${dateKey(currentDate)}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {view === 'agenda' && (
            <AgendaView
              tasks={tasks}
              tasksByDate={tasksByDate}
              currentDate={currentDate}
              onComplete={handleComplete}
            />
          )}
          {view === 'week' && (
            <WeekView
              tasksByDate={tasksByDate}
              currentDate={currentDate}
              onComplete={handleComplete}
            />
          )}
          {view === 'month' && (
            <MonthView
              tasksByDate={tasksByDate}
              currentDate={currentDate}
              onComplete={handleComplete}
            />
          )}
          {view === 'year' && (
            <YearView
              tasksByDate={tasksByDate}
              currentDate={currentDate}
              onSelectMonth={(mi) => {
                setCurrentDate(new Date(currentDate.getFullYear(), mi, 1));
                setView('month');
              }}
            />
          )}
        </motion.div>
    </div>
  );
}
