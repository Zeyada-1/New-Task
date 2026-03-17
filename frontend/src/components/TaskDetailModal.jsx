import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Tag, Pencil, Check, CheckCircle2, Circle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useUndo } from '../context/UndoContext';
import { useTheme } from '../context/ThemeContext';

const PRIORITY_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export default function TaskDetailModal({ task: initialTask, onClose, onComplete, onUncomplete, onEdit }) {
  const { dark } = useTheme();
  const [task, setTask]                       = useState(initialTask);
  const [subtasks, setSubtasks]               = useState(initialTask.subtasks || []);
  const [editingId, setEditingId]             = useState(null);
  const [editingTitle, setEditingTitle]       = useState('');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting]           = useState(false);
  const { registerUndo }                      = useUndo();

  // Fetch fresh task data (includes up-to-date subtasks) on mount.
  // Uses /orbit since that endpoint already returns tasks with nested subtasks
  // and works without requiring a server restart.
  useEffect(() => {
    let alive = true;
    api.get('/orbit')
      .then(res => {
        if (!alive) return;
        const found = res.data.find(t => t.id === initialTask.id);
        if (found) {
          setTask(found);
          setSubtasks(found.subtasks || []);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [initialTask.id]);

  const allDone  = subtasks.length > 0 && subtasks.every(s => s.completed);
  const prioColor = PRIORITY_COLORS[task.priority];
  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();

  const formatDue = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleToggleSubtask = async (sub) => {
    try {
      await api.patch(`/orbit/subtasks/${sub.id}/toggle`);
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s));
    } catch {
      toast.error('Failed to update subtask');
    }
  };

  const startEdit = (sub) => { setEditingId(sub.id); setEditingTitle(sub.title); };

  const saveEdit = async (sub) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed || trimmed === sub.title) return;
    try {
      await api.patch(`/tasks/${sub.id}`, { title: trimmed });
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, title: trimmed } : s));
    } catch {
      toast.error('Failed to rename subtask');
    }
  };

  const attemptComplete = () => {
    if (subtasks.length > 0 && !allDone) {
      setConfirmComplete(true);
    } else {
      doComplete();
    }
  };

  const doComplete = async () => {
    setConfirmComplete(false);
    setCompleting(true);
    try {
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
      onClose();
    } catch {
      toast.error('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="card w-full max-w-lg flex flex-col"
          style={{ maxHeight: '88vh', borderLeft: `4px solid ${task.color || '#e5e3de'}` }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0 gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-neutral-900 break-words leading-snug">{task.title}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                  style={{ background: `${prioColor}18`, color: prioColor }}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
                <span className="flex items-center gap-1 text-xs text-stone-400">
                  <Tag size={10} /> {task.category}
                </span>
                {task.color && (
                  <span className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: task.color }} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { onClose(); onEdit?.(task); }}
                className="text-stone-400 hover:text-orange-400 transition-colors"
                title="Edit task"
              >
                <Pencil size={16} />
              </button>
              <button onClick={onClose} className="text-stone-400 hover:text-neutral-700 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">
            {/* Due date */}
            {task.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className={isOverdue ? 'text-red-400' : 'text-stone-400'} />
                <span className={`text-sm ${isOverdue ? 'text-red-500 font-semibold' : 'text-stone-500'}`}>
                  {formatDue(task.dueDate)}{isOverdue && ' · Overdue'}
                </span>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div>
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-stone-600 text-sm leading-relaxed">{task.description}</p>
              </div>
            )}

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <div>
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide mb-3">
                  Subtasks · {subtasks.filter(s => s.completed).length}/{subtasks.length}
                </p>
                <div className="space-y-2">
                  {subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3 group">
                      <button
                        onClick={() => handleToggleSubtask(sub)}
                        className="flex-shrink-0 transition-transform hover:scale-110"
                      >
                        {sub.completed
                          ? <CheckCircle2 size={18} className="text-emerald-500" />
                          : <Circle size={18} className="text-stone-300 hover:text-orange-400" />}
                      </button>

                      {editingId === sub.id ? (
                        <input
                          autoFocus
                          className="input-field flex-1 text-sm py-1"
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onBlur={() => saveEdit(sub)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(sub);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-stone-400' : 'text-neutral-700'}`}>
                          {sub.title}
                        </span>
                      )}

                      {editingId !== sub.id && (
                        <button
                          onClick={() => startEdit(sub)}
                          className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-orange-400 transition-all flex-shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline confirm dialog */}
            <AnimatePresence>
              {confirmComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="rounded-2xl p-4 border"
                  style={dark
                    ? { background: 'rgba(249,115,22,0.08)', borderColor: '#92400e' }
                    : { background: '#fff7ed', borderColor: '#fed7aa' }}
                >
                  <p className="text-sm font-semibold text-neutral-800 mb-1">
                    {subtasks.every(s => !s.completed)
                      ? 'None of the subtasks are done'
                      : 'Some subtasks aren\'t done'}
                  </p>
                  <p className="text-xs text-stone-500 mb-3">Are you sure you want to complete this task anyway?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmComplete(false)} className="btn-ghost flex-1 text-sm py-1.5">
                      Cancel
                    </button>
                    <button onClick={doComplete} className="btn-primary flex-1 text-sm py-1.5">
                      Complete anyway
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer action */}
            {!confirmComplete && (
              task.completed ? (
                <div className="flex items-center justify-center gap-2 py-2 text-emerald-500 text-sm font-semibold">
                  <CheckCircle2 size={16} />
                  Completed {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''}
                </div>
              ) : (
                <button
                  onClick={attemptComplete}
                  disabled={completing}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  {completing ? 'Completing…' : 'Mark as Complete'}
                </button>
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
