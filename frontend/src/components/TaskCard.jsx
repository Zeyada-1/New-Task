import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Trash2, Calendar, Tag, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useUndo } from '../context/UndoContext';

const PRIORITY_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export default function TaskCard({ task, onComplete, onDelete, onUncomplete, onRestore, onEdit, onOpen }) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState(task.subtasks || []);
  const { registerUndo } = useUndo();

  // Fetch subtasks from /orbit (which always includes them) since the tasks list
  // endpoint may not have returned subtasks if the server predates that change.
  useEffect(() => {
    if (task.subtasks?.length > 0) return; // already have them
    let alive = true;
    api.get('/orbit')
      .then(res => {
        if (!alive) return;
        const found = res.data.find(t => t.id === task.id);
        if (found?.subtasks?.length > 0) setSubtasks(found.subtasks);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const borderColor = task.color || '#e5e3de';
  const prioColor = PRIORITY_COLORS[task.priority];
  const hasSubtasks = subtasks.length > 0;
  const doneCount = subtasks.filter(s => s.completed).length;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (task.completed) {
        await api.patch(`/tasks/${task.id}/uncomplete`);
        onUncomplete?.(task.id);
      } else {
        await api.patch(`/tasks/${task.id}/complete`);
        toast.success('Task completed!');
        onComplete?.(task.id);

        registerUndo({
          label: 'Task completed',
          onUndo: async () => {
            await api.patch(`/tasks/${task.id}/uncomplete`);
            onUncomplete?.(task.id);
          },
        });
      }
    } catch {
      toast.error(task.completed ? 'Failed to uncomplete task' : 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const savedTask = { ...task };
      await api.delete(`/tasks/${task.id}`);
      toast.success('Task deleted');
      onDelete?.(task.id);

      registerUndo({
        label: 'Task deleted',
        onUndo: async () => {
          const { id, createdAt, updatedAt, completedAt, userId, ...data } = savedTask;
          const res = await api.post('/tasks', data);
          onRestore?.(res.data);
        },
      });
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleToggleSubtask = async (sub) => {
    try {
      await api.patch(`/orbit/subtasks/${sub.id}/toggle`);
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s));
    } catch {
      toast.error('Failed to update subtask');
    }
  };

  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();

  const formatDue = (dateStr) => {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: task.completed ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(249,115,22,0.1), 0 4px 12px rgba(0,0,0,0.07)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="card p-4 group hover:border-orange-300"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-start gap-3">
        {/* Complete / Uncomplete Button */}
        <button onClick={handleToggle} disabled={loading} aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'} className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110">
          {task.completed
            ? <CheckCircle2 size={22} className="text-emerald-500 hover:text-stone-400" />
            : <Circle size={22} className="text-stone-400 hover:text-orange-500" />}
        </button>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className="flex-1 min-w-0 font-semibold text-neutral-900 group-hover:text-orange-500 transition-colors cursor-pointer"
              style={{ textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.5 : 1 }}
              onClick={() => onOpen?.(task)}
            >
              {task.title}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasSubtasks && (
                <button
                  onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                  className="flex items-center gap-1 text-xs text-stone-400 hover:text-orange-500 transition-colors px-1.5 py-0.5 rounded-lg hover:bg-orange-50"
                  title={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
                >
                  <span>{doneCount}/{subtasks.length}</span>
                  <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={13} />
                  </motion.span>
                </button>
              )}
              <button onClick={() => onEdit?.(task)} className="text-stone-300 hover:text-orange-400 transition-colors" title="Edit task">
                <Pencil size={14} />
              </button>
              <button onClick={handleDelete} className="text-stone-300 hover:text-red-400 transition-colors">
                <Trash2 size={15} />
              </button>
              {!hasSubtasks && (
                <ChevronRight size={15} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity -ml-0.5" onClick={() => onOpen?.(task)} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <Tag size={10} />
              {task.category}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${prioColor}18`, color: prioColor }}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                <Calendar size={10} />
                {formatDue(task.dueDate)}
                {isOverdue && ' (Overdue)'}
              </span>
            )}
            {task.completed && task.completedAt && (
              <span className="text-xs text-emerald-500">
                ✓ Completed {new Date(task.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Inline subtask list */}
          <AnimatePresence initial={false}>
            {expanded && hasSubtasks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
                  {subtasks.map(sub => (
                    <button
                      key={sub.id}
                      onClick={e => { e.stopPropagation(); handleToggleSubtask(sub); }}
                      className="w-full flex items-center gap-2.5 text-left group/sub hover:bg-orange-50 rounded-xl px-2 py-1.5 transition-colors"
                    >
                      {sub.completed
                        ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                        : <Circle size={15} className="text-stone-300 group-hover/sub:text-orange-400 flex-shrink-0 transition-colors" />}
                      <span className={`text-sm ${sub.completed ? 'line-through text-stone-400' : 'text-neutral-700'}`}>
                        {sub.title}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
