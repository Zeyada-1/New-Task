import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';

const UndoContext = createContext(null);

export function UndoProvider({ children }) {
  const [action, setAction] = useState(null);
  const timerRef = useRef(null);
  const commitRef = useRef(null);
  const actionIdRef = useRef(0);

  const commit = useCallback(() => {
    if (commitRef.current) {
      commitRef.current();
      commitRef.current = null;
    }
    setAction(null);
  }, []);

  const registerUndo = useCallback(({ label, onUndo, onCommit }) => {
    // Commit any previous pending destructive action first
    if (commitRef.current) {
      commitRef.current();
      commitRef.current = null;
    }
    clearTimeout(timerRef.current);

    commitRef.current = onCommit || null;
    actionIdRef.current += 1;
    const id = actionIdRef.current;
    setAction({ id, label, onUndo });

    timerRef.current = setTimeout(() => {
      commit();
    }, 7000);
  }, [commit]);

  const executeUndo = useCallback(async () => {
    clearTimeout(timerRef.current);
    commitRef.current = null;
    const currentAction = action;
    setAction(null);
    if (currentAction?.onUndo) await currentAction.onUndo();
  }, [action]);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    commit();
  }, [commit]);

  return (
    <UndoContext.Provider value={{ registerUndo }}>
      {children}
      <AnimatePresence>
        {action && (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed bottom-6 right-6 z-[100] overflow-hidden"
            style={{ minWidth: 224 }}
          >
            <div className="card px-4 py-3 flex items-center gap-3 shadow-lg relative overflow-hidden">
              {/* Countdown progress strip */}
              <div
                key={`bar-${action.id}`}
                className="absolute bottom-0 left-0 h-[3px] bg-orange-400"
                style={{ animation: 'undo-shrink 7s linear forwards' }}
              />
              <RotateCcw size={14} className="text-stone-400 flex-shrink-0" />
              <span className="text-sm text-neutral-900 flex-1">{action.label}</span>
              <button
                onClick={executeUndo}
                className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Undo
              </button>
              <button
                onClick={dismiss}
                className="text-stone-300 hover:text-stone-500 transition-colors ml-1"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  );
}

export const useUndo = () => useContext(UndoContext);
