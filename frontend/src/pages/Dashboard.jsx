import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Target, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import TaskCard from '../components/TaskCard';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';

export default function Dashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [openTask, setOpenTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const taskBeforeCompleteRef = useRef({});

  useEffect(() => {
    Promise.all([
      api.get('/tasks?completed=false&sort=createdAt&order=desc'),
      api.get('/analytics/overview'),
    ]).then(([tasksRes, ovRes]) => {
      setTasks(tasksRes.data);
      setCompletedCount(ovRes.data.completed ?? 0);
    }).finally(() => setLoading(false));
  }, []);

  const handleTaskAdded = (task) => setTasks((prev) => [task, ...prev]);
  const handleTaskComplete = (id) => {
    const found = tasks.find((t) => t.id === id);
    if (found) taskBeforeCompleteRef.current[id] = found;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setCompletedCount((c) => c + 1);
  };
  const handleTaskDelete = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const handleTaskUncomplete = (id) => {
    const restored = taskBeforeCompleteRef.current[id];
    if (restored) {
      setTasks((prev) => [{ ...restored, completed: false, completedAt: null }, ...prev]);
      delete taskBeforeCompleteRef.current[id];
      setCompletedCount((c) => Math.max(0, c - 1));
    }
  };
  const handleTaskRestore = (task) => setTasks((prev) => [task, ...prev]);
  const handleTaskUpdated = (updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));

  const stats = [
    { icon: Target,      label: 'Active Tasks', value: tasks.length,   color: '#f97316' },
    { icon: CheckCircle, label: 'Completed',     value: completedCount, color: '#10b981' },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-stone-400 animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className={`text-2xl font-bold ${dark ? 'text-stone-100' : 'text-neutral-900'}`}>{greeting}, {user?.username}</h1>
        <p className="text-stone-500 text-sm mt-1">Here’s what’s on your plate today.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">Active Tasks</h2>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
            <Plus size={16} /> New Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle size={36} className="mx-auto mb-3 text-stone-300" />
            <p className="text-stone-400">No active tasks. Add one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleTaskComplete}
                onDelete={handleTaskDelete}
                onUncomplete={handleTaskUncomplete}
                onRestore={handleTaskRestore}
                onEdit={setEditingTask}
                onOpen={setOpenTask}
              />
            ))}
          </div>
        )}
      </div>

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
          onComplete={(id) => { handleTaskComplete(id); setOpenTask(null); }}
          onUncomplete={handleTaskUncomplete}
          onEdit={(t) => { setOpenTask(null); setEditingTask(t); }}
        />
      )}
    </div>
  );
}
