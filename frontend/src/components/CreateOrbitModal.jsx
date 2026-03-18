import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, Plus, Orbit, AlertCircle, GripVertical } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

const ORBIT_TEMPLATES = [
  { label: 'Launch a project', title: 'Launch a project', subtasks: ['Research & define scope', 'Create project plan', 'Build MVP', 'Test & iterate', 'Launch & promote'] },
  { label: 'Study for exam', title: 'Study for exam', subtasks: ['Gather study materials', 'Create study schedule', 'Review key topics', 'Practice with past papers', 'Final revision'] },
  { label: 'Build a habit', title: 'Build a habit', subtasks: ['Define the habit clearly', 'Set a daily trigger', 'Start with 2 minutes', 'Track for 7 days', 'Increase duration gradually'] },
  { label: 'Creative project', title: 'Creative project', subtasks: ['Brainstorm ideas', 'Gather inspiration', 'Create first draft', 'Get feedback', 'Polish & finish'] },
  { label: 'Fitness goal', title: 'Fitness goal', subtasks: ['Set specific target', 'Plan workout routine', 'Prep nutrition plan', 'Track progress weekly', 'Adjust & level up'] },
];

export default function CreateOrbitModal({ onClose, onOrbitCreated }) {
  const { dark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSubtaskWarning, setShowSubtaskWarning] = useState(false);

  const addSubtask = () => {
    const trimmed = subtaskInput.trim();
    if (!trimmed) return;
    setSubtasks(prev => [...prev, trimmed]);
    setSubtaskInput('');
    setShowSubtaskWarning(false);
  };

  const removeSubtask = (index) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (subtasks.length === 0) {
      setShowSubtaskWarning(true);
      return;
    }
    setLoading(true);
    try {
      // Create the orbit (center task)
      const res = await api.post('/orbit', { title: title.trim() });
      const orbitId = res.data.id;

      // Add all subtasks
      for (const sub of subtasks) {
        await api.post(`/orbit/${orbitId}/subtasks`, { title: sub });
      }

      toast.success('Orbit created!');
      onOrbitCreated?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.msg || 'Failed to create orbit');
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
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)' }}>
                <Orbit size={16} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">New Orbit</h2>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-neutral-700 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Info banner */}
          <div className="mx-6 mb-4 p-3 rounded-xl text-xs leading-relaxed"
            style={{
              background: dark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.06)',
              border: `1px solid ${dark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.12)'}`,
              color: dark ? '#fdba74' : '#c2410c',
            }}>
            An orbit is a goal at the center with steps orbiting around it. 
            Add at least one step to create your orbit.
          </div>

          {/* Template picker */}
          <div className="mx-6 mb-4">
            <label className="text-xs text-stone-500 mb-2 block font-medium">Quick start from a template</label>
            <div className="flex flex-wrap gap-2">
              {ORBIT_TEMPLATES.map((tpl) => (
                <button key={tpl.label} type="button"
                  onClick={() => { setTitle(tpl.title); setSubtasks([...tpl.subtasks]); setShowSubtaskWarning(false); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:border-orange-300 hover:shadow-sm"
                  style={{
                    background: dark ? '#292524' : '#fafaf9',
                    borderColor: dark ? '#44403c' : '#e5e3de',
                    color: dark ? '#e7e5e4' : '#57534e',
                  }}>
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Orbit title (the center goal) */}
              <div>
                <label className="text-xs text-stone-500 mb-2 block font-medium">Goal (center of orbit)</label>
                <input
                  type="text"
                  placeholder="e.g. Launch portfolio website"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  className="input-field"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-stone-500 mb-2 block">Description (optional)</label>
                <textarea
                  placeholder="What is this orbit about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="input-field resize-none"
                />
              </div>

              {/* Subtasks (orbiting steps) — required */}
              <div>
                <label className="text-xs text-stone-500 mb-2 block font-medium">
                  Orbiting steps <span className="text-orange-500">*</span>
                </label>

                <div className="space-y-2">
                  <Reorder.Group axis="y" values={subtasks} onReorder={setSubtasks} as="div" className="space-y-2">
                    {subtasks.map((sub, i) => (
                      <Reorder.Item key={sub} value={sub} as="div" className="flex items-center gap-2"
                        whileDrag={{ scale: 1.02, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', borderRadius: 12, background: dark ? '#292524' : '#fafaf9', zIndex: 10 }}>
                        <div className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 flex-shrink-0 touch-none">
                          <GripVertical size={14} />
                        </div>
                        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                          style={{
                            background: dark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)',
                            color: '#f97316',
                          }}>
                          {i + 1}
                        </div>
                        <span className="flex-1 text-sm px-3 py-1.5 rounded-xl border"
                          style={{
                            background: dark ? '#292524' : '#fafaf9',
                            borderColor: dark ? '#44403c' : '#e5e3de',
                            color: dark ? '#e7e5e4' : '#292524',
                          }}>
                          {sub}
                        </span>
                        <button type="button"
                          onClick={() => removeSubtask(i)}
                          className="text-stone-400 hover:text-red-500 transition-colors flex-shrink-0">
                          <X size={14} />
                        </button>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={subtaskInput}
                      onChange={e => { setSubtaskInput(e.target.value); setShowSubtaskWarning(false); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                      placeholder="Add a step..."
                      className="input-field flex-1"
                      style={{ fontSize: 13, padding: '7px 10px' }}
                    />
                    <button type="button" onClick={addSubtask}
                      className="btn-ghost px-3 flex items-center gap-1"
                      style={{ fontSize: 13 }}>
                      <Plus size={13} /> Add
                    </button>
                  </div>

                  {/* Warning when trying to submit without subtasks */}
                  <AnimatePresence>
                    {showSubtaskWarning && subtasks.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: '#ef4444' }}>
                        <AlertCircle size={12} />
                        Add at least one orbiting step to create an orbit
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Creating...' : 'Create Orbit'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
