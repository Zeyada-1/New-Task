import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Check, Plus } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import DateTimePicker from './DateTimePicker';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES = ['General', 'Work', 'Study', 'Health', 'Personal', 'Finance', 'Creative'];
const PRIORITIES = [
  { value: 'LOW',    label: 'Low',    color: '#10b981' },
  { value: 'MEDIUM', label: 'Medium', color: '#f59e0b' },
  { value: 'HIGH',   label: 'High',   color: '#ef4444' },
];
const TASK_COLORS = [
  '#f97316', '#f43f5e', '#ec4899', '#a78bfa',
  '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b',
];

export default function AddTaskModal({ onClose, onTaskAdded, onTaskUpdated, initialTask }) {
  const { dark } = useTheme();
  const isEditing = !!initialTask;
  const [form, setForm] = useState(
    isEditing
      ? {
          title:       initialTask.title       || '',
          description: initialTask.description || '',
          priority:    initialTask.priority    || 'MEDIUM',
          category:    initialTask.category    || 'General',
          color:       initialTask.color       || null,
          dueDate:     initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().slice(0, 16) : '',
        }
      : { title: '', description: '', priority: 'MEDIUM', category: 'General', color: null, dueDate: '' }
  );
  const [loading, setLoading] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [newSubtasks, setNewSubtasks] = useState([]);
  const [existingSubtasks, setExistingSubtasks] = useState(
    isEditing ? (initialTask.subtasks || []) : []
  );

  // Fetch fresh subtasks when editing (page state may be stale)
  useEffect(() => {
    if (!isEditing) return;
    let alive = true;
    api.get('/orbit')
      .then(res => {
        if (!alive) return;
        const found = res.data.find(t => t.id === initialTask.id);
        if (found) setExistingSubtasks(found.subtasks || []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isEditing, initialTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteExistingSubtask = async (subtaskId) => {
    try {
      await api.delete(`/orbit/subtasks/${subtaskId}`);
      setExistingSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    } catch {
      toast.error('Failed to delete subtask');
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const addSubtask = () => {
    const trimmed = subtaskInput.trim();
    if (!trimmed) return;
    setNewSubtasks(prev => [...prev, trimmed]);
    setSubtaskInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.dueDate) delete payload.dueDate;
      if (!payload.description) delete payload.description;
      if (!payload.color) delete payload.color;
      let taskId;
      if (isEditing) {
        const res = await api.patch(`/tasks/${initialTask.id}`, payload);
        taskId = initialTask.id;
        toast.success('Task updated!');
        onTaskUpdated?.(res.data);
      } else {
        const res = await api.post('/tasks', payload);
        taskId = res.data.id;
        toast.success('Task added!');
        onTaskAdded?.(res.data);
      }
      // Create any queued subtasks
      for (const sub of newSubtasks) {
        await api.post(`/orbit/${taskId}/subtasks`, { title: sub });
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.msg || (isEditing ? 'Failed to update task' : 'Failed to add task'));
    } finally {
      setLoading(false);
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="card w-full max-w-md flex flex-col"
          style={{ maxHeight: '92vh' }}
        >
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-neutral-900">{isEditing ? 'Edit Task' : 'New Task'}</h2>
            <button onClick={onClose} className="text-stone-400 hover:text-neutral-700 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Task title..."
              value={form.title}
              onChange={update('title')}
              required
              maxLength={200}
              className="input-field"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={update('description')}
              rows={2}
              className="input-field resize-none"
            />

            {/* Color */}
            <div>
              <label className="text-xs text-stone-500 mb-2 block">Color (optional)</label>
              <div className="flex items-center gap-2 flex-wrap">
                {TASK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: form.color === c ? null : c })}
                    className="w-7 h-7 rounded-full transition-all flex items-center justify-center flex-shrink-0"
                    style={{
                      background: c,
                      outline: form.color === c ? `3px solid ${c}` : '3px solid transparent',
                      outlineOffset: '2px',
                    }}
                    title={c}
                  >
                    {form.color === c && <Check size={12} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-stone-500 mb-2 block">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p.value })}
                    className="py-2 px-3 rounded-xl text-sm font-semibold border transition-all"
                    style={{
                      borderColor: form.priority === p.value ? p.color : '#e5e3de',
                      background: form.priority === p.value ? `${p.color}18` : 'transparent',
                      color: form.priority === p.value ? p.color : '#78716c',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-stone-500 mb-2 block">Category</label>
              <div className="relative">
                <select value={form.category} onChange={update('category')} className="input-field appearance-none pr-8">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              </div>
            </div>

            {/* Due Date & Time */}
            <div>
              <label className="text-xs text-stone-500 mb-2 block">Due Date &amp; Time (optional)</label>
              <DateTimePicker
                value={form.dueDate}
                onChange={(v) => setForm({ ...form, dueDate: v })}
              />
            </div>

            {/* Subtasks */}
            <div>
              <label className="text-xs text-stone-500 mb-2 block">Subtasks (optional)</label>
              <div className="space-y-2">
                {/* Existing subtasks (edit mode) */}
                {existingSubtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    <span className={`flex-1 text-sm px-3 py-1.5 rounded-xl border ${sub.completed ? 'line-through text-stone-400' : 'text-neutral-700'}`}
                      style={dark ? { background: '#292524', borderColor: '#44403c' } : { background: '#fafaf9', borderColor: '#e5e3de' }}>
                      {sub.title}
                    </span>
                    <button type="button"
                      onClick={() => deleteExistingSubtask(sub.id)}
                      className="text-stone-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove subtask">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {/* New subtasks queued to add */}
                {newSubtasks.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-neutral-700 px-3 py-1.5 rounded-xl border"
                      style={dark ? { background: '#292524', borderColor: '#44403c' } : { background: '#fafaf9', borderColor: '#e5e3de' }}>
                      {sub}
                    </span>
                    <button type="button"
                      onClick={() => setNewSubtasks(prev => prev.filter((_, j) => j !== i))}
                      className="text-stone-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtaskInput}
                    onChange={e => setSubtaskInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                    placeholder="Add a subtask..."
                    className="input-field flex-1"
                    style={{ fontSize: 13, padding: '7px 10px' }}
                  />
                  <button type="button" onClick={addSubtask}
                    className="btn-ghost px-3 flex items-center gap-1"
                    style={{ fontSize: 13 }}>
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Task')}
              </button>
            </div>
          </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
