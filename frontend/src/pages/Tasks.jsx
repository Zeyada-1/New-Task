import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import TaskCard from '../components/TaskCard';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';

const FILTERS = ['All', 'Active', 'Completed'];
const PRIORITIES = ['All', 'LOW', 'MEDIUM', 'HIGH'];
const SORT_OPTIONS = [
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'priority-desc', label: 'Priority: High to Low' },
  { value: 'priority-asc', label: 'Priority: Low to High' },
  { value: 'due-asc', label: 'Due date: Soonest first' },
  { value: 'due-desc', label: 'Due date: Latest first' },
  { value: 'title-asc', label: 'Title: A to Z' },
];
const PRIORITY_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { dark } = useTheme();
  const [filter, setFilter] = useState('Active');
  const [priority, setPriority] = useState('All');
  const [sortBy, setSortBy] = useState('created-desc');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [openTask, setOpenTask] = useState(null);

  useEffect(() => {
    api.get('/tasks?sort=createdAt&order=desc')
      .then((r) => setTasks(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleTaskAdded = (task) => setTasks((prev) => [task, ...prev]);
  const handleTaskUpdated = (updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  const handleComplete = (id) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t));
  const handleDelete = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const handleUncomplete = (id) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: false, completedAt: null } : t));
  const handleRestore = (task) => setTasks((prev) => [task, ...prev]);
  const handleConvertToOrbit = (id) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, isOrbit: true } : t));

  const filtered = tasks.filter((t) => {
    if (filter === 'Active' && t.completed) return false;
    if (filter === 'Completed' && !t.completed) return false;
    if (priority !== 'All' && t.priority !== priority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'created-asc':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'priority-desc':
        return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
      case 'priority-asc':
        return (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
      case 'due-asc': {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      }
      case 'due-desc': {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.NEGATIVE_INFINITY;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.NEGATIVE_INFINITY;
        return bTime - aTime;
      }
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'created-desc':
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${dark ? 'text-stone-100' : 'text-neutral-900'}`}>My Tasks</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 py-2 px-4">
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Status filter */}
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f ? 'bg-orange-500 text-white' : 'text-stone-500 hover:text-neutral-900 hover:bg-stone-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <div className="flex gap-1 flex-wrap">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  priority === p ? 'bg-orange-500 text-white' : 'text-stone-500 hover:text-neutral-900 hover:bg-stone-100'
                }`}
              >
                {p === 'All' ? 'All Priority' : p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <span className="flex items-center gap-1 text-xs text-stone-500 whitespace-nowrap">
              <ArrowUpDown size={13} />
              Sort
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field py-1.5 px-2 text-sm flex-1 sm:flex-none sm:min-w-[180px]"
              style={{
                background: dark ? '#1c1917' : '#ffffff',
                color: dark ? '#e7e5e4' : '#292524',
                borderColor: dark ? '#44403c' : '#d6d3d1',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  style={{
                    background: dark ? '#1c1917' : '#ffffff',
                    color: dark ? '#e7e5e4' : '#292524',
                  }}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-stone-400 text-sm">{sorted.length} task{sorted.length !== 1 ? 's' : ''} found</p>

      {/* Task List */}
      {loading ? (
        <div className="text-center text-stone-400 animate-pulse py-12">Loading tasks...</div>
      ) : sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-stone-400">No tasks found. {filter === 'Active' && 'Add a new task to begin!'}</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {sorted.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} onDelete={handleDelete} onUncomplete={handleUncomplete} onRestore={handleRestore} onEdit={setEditingTask} onOpen={setOpenTask} onConvertToOrbit={handleConvertToOrbit} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {showModal && (
        <AddTaskModal onClose={() => setShowModal(false)} onTaskAdded={handleTaskAdded} />
      )}
      {editingTask && (
        <AddTaskModal
          onClose={() => setEditingTask(null)}
          initialTask={editingTask}
          onTaskUpdated={(updated) => { handleTaskUpdated(updated); setEditingTask(null); }}
        />
      )}
      {openTask && (
        <TaskDetailModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onComplete={(id) => { handleComplete(id); setOpenTask(null); }}
          onUncomplete={handleUncomplete}
          onEdit={(t) => { setOpenTask(null); setEditingTask(t); }}
        />
      )}
    </div>
  );
}
