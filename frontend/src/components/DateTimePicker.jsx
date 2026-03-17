import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_H = 40;
const VISIBLE_ITEMS = 3; // odd number so one item is always centred
const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const AMPM    = ['AM', 'PM'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['M','T','W','T','F','S','S'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// ── Drum-roll column (iOS-style) ──────────────────────────────────────────────

function DrumColumn({ items, value, onChange, width = 'flex-1', dark = false }) {
  const scrollRef   = useRef(null);
  const debounce    = useRef(null);
  const programmatic = useRef(false);

  const pad = Math.floor(VISIBLE_ITEMS / 2); // 1 for 3-item view

  const scrollToIdx = (idx, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    programmatic.current = true;
    if (smooth) {
      el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
      setTimeout(() => { programmatic.current = false; }, 500);
    } else {
      el.scrollTop = idx * ITEM_H; // direct assignment — most reliable for instant
      programmatic.current = false;
    }
  };

  // Scroll to initial position without animation on mount.
  // We attempt immediately (rAF) AND after 280ms — the parent AnimatePresence
  // animates height 0→auto over 200ms, during which scrollTop can't be set
  // on a zero-height container. The delayed attempt fires after the animation.
  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx < 0) return;
    const attempt = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = idx * ITEM_H;
    };
    requestAnimationFrame(attempt);
    const t = setTimeout(attempt, 280);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll when value changes externally
  const prevValue = useRef(value);
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      const idx = items.indexOf(value);
      if (idx >= 0) scrollToIdx(idx, true);
    }
  }, [value, items]);

  const handleScroll = () => {
    if (programmatic.current) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      if (items[clamped] !== value) onChange(items[clamped]);
      scrollToIdx(clamped, true);
    }, 100);
  };

  return (
    <div className={`relative ${width} select-none`} style={{ height: ITEM_H * VISIBLE_ITEMS }}>
      {/* Selection highlight band */}
      <div
        className="absolute inset-x-0 pointer-events-none rounded-lg"
        style={{
          top: ITEM_H * pad,
          height: ITEM_H,
          zIndex: 2,
          background: 'rgba(249,115,22,0.12)',
          borderTop: '1px solid rgba(249,115,22,0.4)',
          borderBottom: '1px solid rgba(249,115,22,0.4)',
        }}
      />
      {/* Top fade-out */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: ITEM_H * pad, zIndex: 3, background: `linear-gradient(to bottom, ${dark ? 'rgba(28,25,23,0.97)' : 'rgba(247,246,243,0.97)'} 20%, transparent)` }}
      />
      {/* Bottom fade-out */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: ITEM_H * pad, zIndex: 3, background: `linear-gradient(to top, ${dark ? 'rgba(28,25,23,0.97)' : 'rgba(247,246,243,0.97)'} 20%, transparent)` }}
      />

      <div
        ref={scrollRef}
        className="no-scrollbar h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollPaddingTop: `${ITEM_H * pad}px`, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        onScroll={handleScroll}
      >
        {/* Top padding so first item can be centred */}
        <div style={{ height: ITEM_H * pad, flexShrink: 0 }} />

        {items.map((item) => (
          <div
            key={item}
            style={{ height: ITEM_H, scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            className={`flex items-center justify-center font-semibold cursor-pointer transition-all duration-150 ${
              item === value
                ? 'text-orange-500 text-xl'
                : `text-stone-400 text-base ${dark ? 'hover:text-stone-100' : 'hover:text-neutral-900'}`
            }`}
            onClick={() => {
              const idx = items.indexOf(item);
              onChange(item);
              scrollToIdx(idx);
            }}
          >
            {item}
          </div>
        ))}

        {/* Bottom padding so last item can be centred */}
        <div style={{ height: ITEM_H * pad, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ selected, onChange, dark = false }) {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const [view, setView] = useState(() => {
    const base = selected || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();

  // Build Monday-first grid
  const firstDow = new Date(year, month, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - offset);
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Only allow going back if prev month still has future dates
  const prevMonthLast = new Date(year, month, 0);
  prevMonthLast.setHours(0, 0, 0, 0);
  const canGoPrev = prevMonthLast >= todayMidnight;

  return (
    <div>
      {/* Month/year navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={() => setView(new Date(year, month - 1, 1))}
          disabled={!canGoPrev}
          className={`p-1.5 rounded-lg transition-colors ${
            canGoPrev
              ? (dark ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-700' : 'text-stone-500 hover:text-neutral-900 hover:bg-stone-100')
              : (dark ? 'text-stone-700 cursor-not-allowed' : 'text-stone-200 cursor-not-allowed')
          }`}
        >
          <ChevronLeft size={14} />
        </button>
        <span className={`text-sm font-bold ${dark ? 'text-stone-100' : 'text-neutral-900'}`}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setView(new Date(year, month + 1, 1))}
          className={`p-1.5 rounded-lg ${dark ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-700' : 'text-stone-500 hover:text-neutral-900 hover:bg-stone-100'} transition-colors`}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-xs text-stone-400 font-semibold py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isPast = d < todayMidnight;
          const isToday = isSameDay(d, todayMidnight);
          const isSel = selected && isSameDay(d, selected);

          return (
            <button
              key={i}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onChange(d)}
              className={[
                'h-8 w-8 mx-auto rounded-full text-xs font-semibold flex items-center justify-center transition-all',
                !inMonth || isPast ? (dark ? 'text-stone-600 cursor-default' : 'text-stone-200 cursor-default') : '',
                isSel ? 'bg-orange-500 text-white shadow-sm' : '',
                isToday && !isSel ? 'ring-1 ring-orange-400 text-orange-500' : '',
                inMonth && !isPast && !isSel ? (dark ? 'text-stone-300 hover:bg-orange-900/30 hover:text-orange-400 cursor-pointer' : 'text-stone-600 hover:bg-orange-50 hover:text-orange-600 cursor-pointer') : '',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main DateTimePicker ───────────────────────────────────────────────────────

export default function DateTimePicker({ value, onChange, placeholder = 'Set due date & time...' }) {
  const { dark } = useTheme();
  const [open, setOpen] = useState(false);

  // Local state for each part
  const parseValue = (v) => (v ? new Date(v) : null);
  const initial = parseValue(value);

  const [selDate, setSelDate] = useState(() => {
    if (!initial) return null;
    return new Date(initial.getFullYear(), initial.getMonth(), initial.getDate());
  });
  const [hour,   setHour]   = useState(() => initial ? String(initial.getHours() % 12 || 12).padStart(2, '0') : '09');
  const [minute, setMinute] = useState(() => initial ? String(initial.getMinutes()).padStart(2, '0') : '00');
  const [ampm,   setAmpm]   = useState(() => initial ? (initial.getHours() >= 12 ? 'PM' : 'AM') : 'AM');

  // Skip the first effect run (mount) — only fire when user actually changes something
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (!selDate) { onChange(''); return; }
    const d = new Date(selDate);
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    d.setHours(h, parseInt(minute, 10), 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    onChange(iso);
  }, [selDate, hour, minute, ampm]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayLabel = () => {
    if (!selDate) return null;
    const d = new Date(selDate);
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    d.setHours(h, parseInt(minute, 10));
    return (
      d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · ' + `${hour}:${minute} ${ampm}`
    );
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelDate(null);
    onChange('');
  };

  // True only when TODAY is selected and the chosen time is already in the past
  const isPastDateTime = (() => {
    if (!selDate) return false;
    const now = new Date();
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    const selMid = new Date(selDate); selMid.setHours(0, 0, 0, 0);
    if (selMid.getTime() !== todayMid.getTime()) return false; // future date → always ok
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const d = new Date(selDate);
    d.setHours(h, parseInt(minute, 10), 0, 0);
    return d <= now;
  })();

  return (
    <div>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center gap-2 text-left cursor-pointer w-full"
      >
        <CalendarDays size={14} className="text-stone-400 flex-shrink-0" />
        <span className={`flex-1 text-sm ${selDate ? (dark ? 'text-stone-100' : 'text-neutral-900') : 'text-stone-400'}`}>
          {displayLabel() || placeholder}
        </span>
        {selDate && (
          <span
            onClick={handleClear}
            className="text-stone-400 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {/* Inline picker panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-xl p-4"
              style={{ background: dark ? '#1c1917' : '#ffffff', border: `1px solid ${dark ? '#44403c' : '#e5e3de'}` }}
            >
              {/* Calendar */}
              <MiniCalendar selected={selDate} onChange={setSelDate} dark={dark} />

              {/* Divider */}
              <div className="my-4" style={{ borderTop: `1px solid ${dark ? '#44403c' : '#e5e3de'}` }} />

              {/* Time header */}
              <div className="flex items-center gap-1.5 mb-1">
                <Clock size={11} className="text-stone-400" />
                <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Time</span>
              </div>

              {/* Drum-roll columns */}
              <div className="flex items-stretch rounded-xl overflow-hidden"
                style={{ background: dark ? '#1c1917' : '#f7f6f3', border: `1px solid ${dark ? '#44403c' : '#e5e3de'}` }}>
                <DrumColumn items={HOURS} value={hour} onChange={setHour} dark={dark} />
                <div className="flex items-center justify-center text-stone-400 text-xl font-bold px-1 self-center"
                  style={{ height: ITEM_H * VISIBLE_ITEMS }}>
                  :
                </div>
                <DrumColumn items={MINUTES} value={minute} onChange={setMinute} dark={dark} />
                {/* Separator */}
                <div style={{ width: 1, background: dark ? '#44403c' : '#e5e3de', margin: '12px 0' }} />
                <DrumColumn items={AMPM} value={ampm} onChange={setAmpm} width="w-16" dark={dark} />
              </div>

              {/* Past-time warning */}
              {isPastDateTime && (
                <p className="text-xs text-amber-400 text-center mt-3 flex items-center justify-center gap-1">
                  <span>⚠</span> This time has already passed
                </p>
              )}
              {/* Confirm / Done */}
              <button
                type="button"
                onClick={() => { if (!isPastDateTime) setOpen(false); }}
                disabled={isPastDateTime}
                className={`btn-primary w-full py-2 text-sm mt-3 transition-opacity ${
                  isPastDateTime ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {isPastDateTime ? "Can't use a past time" : (selDate ? 'Done' : 'Close')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
