import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Plus, X, Trash2, ChevronLeft, Check, Pencil, Moon, Sun } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import AddTaskModal from '../components/AddTaskModal';
import CreateOrbitModal from '../components/CreateOrbitModal';

/*  constants  */
const BASE_RADIUS     = 200;
const RING_GAP        = 110;
const SPHERE_SIZE     = 108;
const RING_CAPACITIES = [5, 8, 11, 14, 17];
const RING_DURATIONS  = [30, 42, 54, 66, 78];

/*  helpers  */
function completionOf(node) {
  if (!node.subtasks || node.subtasks.length === 0) return node.completed ? 1 : 0;
  const total = countLeaves(node);
  const done  = countDoneLeaves(node);
  return total > 0 ? done / total : 0;
}
function countLeaves(node) {
  if (!node.subtasks || node.subtasks.length === 0) return 1;
  return node.subtasks.reduce((s, c) => s + countLeaves(c), 0);
}
function countDoneLeaves(node) {
  if (!node.subtasks || node.subtasks.length === 0) return node.completed ? 1 : 0;
  return node.subtasks.reduce((s, c) => s + countDoneLeaves(c), 0);
}
function hasChildren(node) {
  return node.subtasks && node.subtasks.length > 0;
}

/*  ring distribution 
   Planets are distributed across concentric rings. Every planet on the SAME
   ring shares an identical duration so they never collide with each other.
*/
function assignRings(planets) {
  const result = [];
  let pool = [...planets];
  let ri = 0;
  while (pool.length > 0) {
    const cap   = RING_CAPACITIES[Math.min(ri, RING_CAPACITIES.length - 1)];
    const slice = pool.splice(0, cap);
    slice.forEach((p, pos) => result.push({ planet: p, ringIndex: ri, posInRing: pos, ringSize: slice.length }));
    ri++;
  }
  return result;
}

/*  Shared ring phase — ALL planets in a ring call this with the SAME t0 and dur,
    so dPhase/dt is identical for every planet → spacing is always perfectly equal.
    The wobble makes the whole group breathe (speed up / slow down) together.
*/
function ringPhaseAt(elapsedSec, dur) {
  const base   = (elapsedSec / dur) * 360;
  // Gentle sinusoidal wobble: amplitude ±22°, period = dur * 1.618 (golden ratio → aperiodic feel)
  const wobble = 22 * Math.sin((2 * Math.PI / (dur * 1.618)) * elapsedSec);
  return base + wobble;
}

const REDIST_MS = 480;

// Galaxy particle layer — adapts to dark/light mode
function GalaxyParticles({ dark }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    const particles = dark
      ? Array.from({ length: 260 }, (_, i) => ({
          x: Math.random() * W, y: Math.random() * H,
          r: i < 200 ? 0.5 + Math.random() * 0.9 : 1.2 + Math.random() * 1.6,
          dx: (Math.random() - 0.5) * 0.12, dy: (Math.random() - 0.5) * 0.12,
          phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 1.1,
          baseAlpha: i < 200 ? 0.35 + Math.random() * 0.55 : 0.2 + Math.random() * 0.4,
          warm: i >= 200 && Math.random() > 0.5,
        }))
      : Array.from({ length: 120 }, (_, i) => ({
          x: Math.random() * W, y: Math.random() * H,
          r: i < 90 ? 0.6 + Math.random() * 1.2 : 1.4 + Math.random() * 1.8,
          dx: (Math.random() - 0.5) * 0.09, dy: (Math.random() - 0.5) * 0.09,
          phase: Math.random() * Math.PI * 2, speed: 0.2 + Math.random() * 0.6,
          baseAlpha: i < 90 ? 0.28 + Math.random() * 0.32 : 0.2 + Math.random() * 0.28,
          warm: i >= 90,
        }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const now = performance.now() / 1000;
      for (const p of particles) {
        const alpha = p.baseAlpha * (0.4 + 0.6 * Math.sin(now * p.speed + p.phase));
        if (dark) {
          if (p.warm) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = `rgba(249,115,22,${alpha * 0.8})`;
            ctx.fillStyle = `rgba(255,180,100,${alpha})`;
          } else {
            ctx.shadowBlur = p.r > 1 ? 4 : 0;
            ctx.shadowColor = `rgba(255,255,255,${alpha * 0.5})`;
            ctx.fillStyle = `rgba(255,250,240,${alpha})`;
          }
        } else {
          ctx.shadowBlur = 0;
          // light mode: warm dark-brown main dots + amber-gold accent dots
          ctx.fillStyle = p.warm
            ? `rgba(200,140,60,${alpha})`
            : `rgba(115,92,65,${alpha})`;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        p.x = (p.x + p.dx + W) % W;
        p.y = (p.y + p.dy + H) % H;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [dark]);

  return (
    <canvas ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
               pointerEvents: 'none', zIndex: 0 }} />
  );
}

// Occasional shooting stars
function ShootingStars({ dark }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    const stars = [];
    let nextSpawn = performance.now() + 3000 + Math.random() * 4000;
    const spawn = () => {
      const angle = (18 + Math.random() * 14) * Math.PI / 180;
      stars.push({
        x: Math.random() * W * 0.7 + W * 0.1,
        y: Math.random() * H * 0.35,
        angle,
        length: 90 + Math.random() * 160,
        dist: 0,
        totalDist: 280 + Math.random() * 340,
        speed: 520 + Math.random() * 380,
        done: false,
      });
    };

    const col = dark ? '255,250,240' : '160,148,130';
    const lw  = dark ? 1.4 : 0.9;
    let last = performance.now();
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (now >= nextSpawn) { spawn(); nextSpawn = now + 5000 + Math.random() * 7000; }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.dist += s.speed * dt;
        const prog = Math.min(s.dist / s.totalDist, 1);
        if (prog >= 1) { stars.splice(i, 1); continue; }
        const alpha = prog < 0.15 ? prog / 0.15 : prog > 0.75 ? (1 - prog) / 0.25 : 1;
        const headX = s.x + Math.cos(s.angle) * s.dist;
        const headY = s.y + Math.sin(s.angle) * s.dist;
        const tailX = headX - Math.cos(s.angle) * s.length;
        const tailY = headY - Math.sin(s.angle) * s.length;
        const g = ctx.createLinearGradient(tailX, tailY, headX, headY);
        g.addColorStop(0,   `rgba(${col},0)`);
        g.addColorStop(0.5, `rgba(${col},${(alpha * 0.28).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${col},${(alpha * 0.85).toFixed(3)})`);
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(headX, headY);
        ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [dark]);

  return (
    <canvas ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
               pointerEvents: 'none', zIndex: 0 }} />
  );
}

function SpinningOrbit({ children, radius, ringIndex, posInRing, ringSize, cx, cy, ringStartTime, isNew, speeding, angleRef }) {
  const PLANET_HALF = 19;
  const dur = RING_DURATIONS[Math.min(ringIndex, RING_DURATIONS.length - 1)];

  const elRef  = useRef(null);
  const rafRef = useRef(null);
  // Keep latest prop values accessible inside the RAF callback without re-creating it
  const pRef   = useRef({ cx, cy, radius, dur, t0: ringStartTime ?? Date.now() });
  pRef.current = { cx, cy, radius, dur, t0: ringStartTime ?? Date.now() };

  const spacingOffset = (posInRing / Math.max(ringSize, 1)) * 360;

  // All mutable animation state lives here; never triggers re-renders
  const sRef = useRef(null);
  if (!sRef.current) {
    sRef.current = {
      mode: 'orbit',
      spacingOff: spacingOffset,
      redistFrom: 0, redistDelta: 0, redistStart: 0, redistNewOff: 0,
      enterStart: null, // set by useEffect below when isNew fires
      enterDur:   750,
      speeding:   false,
      speedStart: 0,
      speedAngle: 0,
    };
  }

  // Trigger enter animation when parent signals this planet is newly added.
  // useEffect is safe from Strict Mode double-render; it fires once after real mount.
  useEffect(() => {
    if (isNew && sRef.current && sRef.current.enterStart === null) {
      sRef.current.enterStart = Date.now();
    }
  }, [isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single RAF loop for the lifetime of this component
  useEffect(() => {
    const tick = () => {
      const el = elRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(tick); return; }
      const s  = sRef.current;
      const pr = pRef.current;
      let angle;

      // Enter: grow radius from 0 → target while orbiting normally
      let displayRadius = pr.radius;
      if (s.enterStart !== null) {
        const ep = Math.min((Date.now() - s.enterStart) / s.enterDur, 1);
        const eq = 1 - Math.pow(1 - ep, 3);
        displayRadius = pr.radius * eq;
        if (ep >= 1) s.enterStart = null;
      }

      // Speed-up: stays locked on the orbit ring but spins with a quadratic velocity ramp
      if (s.speeding) {
        const age = (Date.now() - s.speedStart) / 1000;
        const k   = 5;   // matches the k used in handleToggle to predict final position
        // Integrated velocity (w = w0*(1+k*t)): Δangle = w0*(age + k*age²/2)
        angle = s.speedAngle + (360 / pr.dur) * (age + k * age * age / 2);
        // radius unchanged — planet stays on its orbit ring
      } else if (s.mode === 'redist') {
        const p = Math.min((Date.now() - s.redistStart) / REDIST_MS, 1);
        const e = p < 0.5 ? 2*p*p : -1 + (4 - 2*p)*p; // smooth-step ease-in-out
        angle   = s.redistFrom + s.redistDelta * e;
        if (p >= 1) {
          s.mode      = 'orbit';
          s.spacingOff = s.redistNewOff;
        }
      } else {
        const elapsed = (Date.now() - pr.t0) / 1000;
        angle = ringPhaseAt(elapsed, pr.dur) + s.spacingOff;
      }

      if (angleRef) angleRef.current = angle;
      el.style.transform =
        `translate(${pr.cx}px,${pr.cy}px) rotate(${angle}deg) translateX(${displayRadius}px) rotate(-${angle}deg) translate(-${PLANET_HALF}px,-${PLANET_HALF}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speed-up mode: snapshot current angle so acceleration continues smoothly from here
  useEffect(() => {
    if (speeding && sRef.current && !sRef.current.speeding) {
      const s  = sRef.current;
      const pr = pRef.current;
      let currentAngle;
      if (s.mode === 'redist') {
        const p = Math.min((Date.now() - s.redistStart) / REDIST_MS, 1);
        const e = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
        currentAngle = s.redistFrom + s.redistDelta * e;
      } else {
        const elapsed = (Date.now() - pr.t0) / 1000;
        currentAngle  = ringPhaseAt(elapsed, pr.dur) + s.spacingOff;
      }
      s.speeding   = true;
      s.speedStart = Date.now();
      s.speedAngle = currentAngle;
    } else if (!speeding && sRef.current) {
      sRef.current.speeding = false;
    }
  }, [speeding]); // eslint-disable-line react-hooks/exhaustive-deps

  // When posInRing/ringSize changes, smoothly slide to the new equally-spaced position
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (ringSize === 1) return; // last planet in ring — no peer to space against, stay put

    const s  = sRef.current;
    const pr = pRef.current;

    // Where is the planet right now?
    let fromDeg;
    if (s.mode === 'redist') {
      const p = Math.min((Date.now() - s.redistStart) / REDIST_MS, 1);
      const e = p < 0.5 ? 2*p*p : -1 + (4 - 2*p)*p;
      fromDeg = s.redistFrom + s.redistDelta * e;
    } else {
      const elapsed = (Date.now() - pr.t0) / 1000;
      fromDeg = ringPhaseAt(elapsed, pr.dur) + s.spacingOff;
    }

    // Target: ring position at the moment the transition finishes — so orbit resumes
    // exactly on-beat with no position jump.
    const elapsedAtEnd = (Date.now() + REDIST_MS - pr.t0) / 1000;
    const toDeg        = ringPhaseAt(elapsedAtEnd, pr.dur) + spacingOffset;

    // Take the shorter arc
    let delta = toDeg - fromDeg;
    while (delta >  180) delta -= 360;
    while (delta < -180) delta += 360;

    s.mode        = 'redist';
    s.redistFrom  = fromDeg;
    s.redistDelta = delta;
    s.redistStart = Date.now();
    s.redistNewOff = spacingOffset;
  }, [spacingOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={elRef} style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      {children}
    </div>
  );
}

/* ── Planet ─────────────────────────────────────────────────────────────────── */
function Planet({ node, orbitRadius, ringIndex, posInRing, ringSize,
                  index, total, onToggle, onDelete, onExpand, spinning, zoom, cx, cy, ringStartTime, isNew, speeding, angleRef }) {
  const [hovered, setHovered] = useState(false);
  const prog       = completionOf(node);
  const isComplete = prog >= 1 && countLeaves(node) > 0;
  const expandable = hasChildren(node);
  const SIZE       = 38;
  const showLabel  = (zoom ?? 1) >= 0.85;

  const sphere = (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}
         onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {expandable && (
        <svg width={SIZE + 8} height={SIZE + 8}
             style={{ position: 'absolute', top: -4, left: -4, pointerEvents: 'none' }}>
          <circle cx={(SIZE+8)/2} cy={(SIZE+8)/2} r={(SIZE+8)/2 - 2}
            fill="none" stroke="#e5e3de" strokeWidth="1.5" />
          {prog > 0 && (
            <circle cx={(SIZE+8)/2} cy={(SIZE+8)/2} r={(SIZE+8)/2 - 2}
              fill="none" stroke={isComplete ? '#10b981' : '#f97316'}
              strokeWidth="1.5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * ((SIZE+8)/2 - 2)}
              strokeDashoffset={2 * Math.PI * ((SIZE+8)/2 - 2) * (1 - prog)}
              style={{ transformOrigin: `${(SIZE+8)/2}px ${(SIZE+8)/2}px`,
                       transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 0.6s ease' }} />
          )}
        </svg>
      )}
      <button onClick={expandable ? onExpand : onToggle} style={{
        width: SIZE, height: SIZE, borderRadius: '50%', cursor: 'pointer',
        background: isComplete ? '#4b5563' : '#57534e',
        border: `2px solid ${isComplete ? '#374151' : '#44403c'}`,
        boxShadow: isComplete
          ? 'inset 0 0 14px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.35)'
          : 'inset 0 0 10px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 1, overflow: 'hidden',
        padding: showLabel ? '2px 3px' : 0,
        transition: 'background 0.3s, border-color 0.3s',
        position: 'relative', zIndex: 2,
      }}>
        {showLabel ? (
          <>
            <span style={{
              fontSize: 7, fontWeight: 700, lineHeight: 1.2, textAlign: 'center',
              color: '#fafaf9',
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              maxWidth: SIZE - 6, wordBreak: 'break-word',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{node.title}</span>
            {expandable && (
              <span style={{ fontSize: 6, color: 'rgba(250,250,249,0.75)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                {countDoneLeaves(node)}/{countLeaves(node)}
              </span>
            )}
          </>
        ) : expandable ? (
          <span style={{ fontSize: 8, fontWeight: 700, color: '#fafaf9',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            {countDoneLeaves(node)}/{countLeaves(node)}
          </span>
        ) : (
          isComplete && <Check size={11} color="white" strokeWidth={3} />
        )}
      </button>

      <AnimatePresence>
        {hovered && (
          <motion.button initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }} onClick={onDelete}
            style={{ position: 'absolute', top: -6, right: -6, width: 17, height: 17,
              borderRadius: '50%', background: '#ef4444', color: 'white',
              border: '1.5px solid white', cursor: 'pointer', zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={8} strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Always-visible floating label below sphere */}
      {!showLabel && (
        <div style={{
          position: 'absolute', top: SIZE + 4, left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 8, fontWeight: 600,
          color: 'rgba(250,250,249,0.7)',
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
          textAlign: 'center',
          pointerEvents: 'none', zIndex: 5,
          letterSpacing: 0.2,
        }}>
          {node.title}
        </div>
      )}

      {/* Expanded hover tooltip (only when zoomed-in label is active) */}
      <AnimatePresence>
        {hovered && showLabel && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{ position: 'absolute', top: SIZE + 8, left: '50%',
              transform: 'translateX(-50%)', background: '#171717', color: '#fafaf9',
              padding: '3px 8px', borderRadius: 6, fontSize: 10, whiteSpace: 'nowrap',
              zIndex: 30, fontWeight: 500, maxWidth: 160, pointerEvents: 'none' }}>
            {node.title}{expandable && <span style={{ opacity: 0.6 }}> · expand</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!spinning) {
    const angle = (index / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
    return (
      <div style={{ position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%,-50%) translate(${Math.cos(angle)*orbitRadius}px,${Math.sin(angle)*orbitRadius}px)` }}>
        {sphere}
      </div>
    );
  }

  return (
    <SpinningOrbit radius={orbitRadius} ringIndex={ringIndex} posInRing={posInRing} ringSize={ringSize}
      cx={cx} cy={cy} ringStartTime={ringStartTime} isNew={isNew} speeding={speeding} angleRef={angleRef}>
      {sphere}
    </SpinningOrbit>
  );
}

/* ── Full-screen orbit view ─────────────────────────────────────────────────── */
function OrbitView({ node, onClose, onUpdate, cardRect = null, depth = 0 }) {
  const [showAddForm, setShowAddForm]       = useState(false);
  const [newTitle, setNewTitle]             = useState('');
  const [adding, setAdding]                 = useState(false);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editingCenter, setEditingCenter]   = useState(null);
  const [centerHovered, setCenterHovered]   = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState(null);
  const [expandedChild, setExpandedChild]   = useState(null);
  const [zoom, setZoom]                   = useState(1);
  const [escapingPlanets, setEscapingPlanets] = useState({});
  const [goneIds, setGoneIds]             = useState(() => new Set(
    (node.subtasks || []).filter(s => s.completed).map(s => s.id)
  ));

  // Inverse parallax — mouse offset drives a subtle counter-shift of the arena
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px   = useSpring(rawX, { stiffness: 60, damping: 18, mass: 0.8 });
  const py   = useSpring(rawY, { stiffness: 60, damping: 18, mass: 0.8 });
  const handleMouseMove = (e) => {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    // inverse: arena moves opposite to the mouse, capped at ±18px
    rawX.set(-((e.clientX - cx) / cx) * 18);
    rawY.set(-((e.clientY - cy) / cy) * 18);
  };
  const handleMouseLeave = () => { rawX.set(0); rawY.set(0); };
  const { dark, setDark } = useTheme();

  const T = dark ? {
    bg:          '#0e0c0a',
    outerRing:   (i) => i === 0 ? '#f97316' : 'rgba(255,255,255,0.18)',
    trackBand:   'rgba(249,115,22,0.07)',
    trackDash:   'rgba(255,255,255,0.18)',
    btnBg:       'rgba(20,16,12,0.85)',
    btnBorder:   'rgba(255,255,255,0.12)',
    btnColor:    '#e7e5e4',
    mutedText:   'rgba(255,255,255,0.4)',
    panelBg:     'rgba(30,25,20,0.85)',
    panelBorder: 'rgba(255,255,255,0.1)',
    panelPct:    'rgba(255,255,255,0.5)',
    panelLabel:  'rgba(255,255,255,0.3)',
    addColor:    'rgba(255,255,255,0.4)',
  } : {
    bg:          '#eae6df',
    outerRing:   (i) => i === 0 ? 'rgba(249,115,22,0.5)' : '#c8c3bb',
    trackBand:   'rgba(0,0,0,0.03)',
    trackDash:   'rgba(0,0,0,0.13)',
    btnBg:       'rgba(255,255,255,0.92)',
    btnBorder:   '#e5e3de',
    btnColor:    '#57534e',
    mutedText:   '#a8a29e',
    panelBg:     'rgba(255,255,255,0.88)',
    panelBorder: '#e5e3de',
    panelPct:    '#78716c',
    panelLabel:  '#a8a29e',
    addColor:    '#a8a29e',
  };

  const [speedingIds, setSpeedingIds] = useState(() => new Set());
  const arenaRef         = useRef(null);
  const planetMountTime  = useRef({});
  const planetAngleRefs  = useRef({});

  const subtasks      = node.subtasks || [];
  // Hide tasks that have escaped (completed + animation played)
  const displaySubtasks = subtasks.filter(s => !goneIds.has(s.id));

  const total       = subtasks.length;
  const prog        = completionOf(node);
  const doneLeaves  = countDoneLeaves(node);
  const totalLeaves = countLeaves(node);
  const isComplete  = prog >= 1 && totalLeaves > 0;

  // Arena size stays stable based on ALL subtasks so it doesn't jump during completion
  const allAssignments = assignRings(subtasks);
  const numRingsStatic = allAssignments.length > 0
    ? Math.max(...allAssignments.map(a => a.ringIndex)) + 1 : 1;

  const ringAssignments = assignRings(displaySubtasks);
  const numRings  = ringAssignments.length > 0
    ? Math.max(...ringAssignments.map(a => a.ringIndex)) + 1 : 1;  // eslint-disable-line no-unused-vars
  const maxRadius  = BASE_RADIUS + (numRingsStatic - 1) * RING_GAP;
  const arenaHalf  = maxRadius + 90;
  const arenaSize  = arenaHalf * 2;
  const sphereOff  = arenaHalf - SPHERE_SIZE / 2;

  // Stable per-ring start time so all planets in a ring share the same phase origin
  const ringStartTimes = useRef({});
  // joiningIds: planets that were just added — set via useEffect so Strict Mode double-render
  // doesn't corrupt the detection. Cleared after the enter animation finishes.
  // Pre-populate with existing IDs so opening an orbit doesn't burst planets from center.
  const knownIds   = useRef(new Set(displaySubtasks.map(s => s.id)));
  const [joiningIds, setJoiningIds] = useState(() => new Set());

  ringAssignments.forEach(({ planet: s, ringIndex }) => {
    if (ringStartTimes.current[ringIndex] === undefined)
      ringStartTimes.current[ringIndex] = Date.now();
    if (!planetMountTime.current[s.id]) planetMountTime.current[s.id] = Date.now();
  });

  // Detect truly new planets in an effect (immune to double-render)
  useEffect(() => {
    const currentIds = new Set(displaySubtasks.map(s => s.id));
    const added = [...currentIds].filter(id => !knownIds.current.has(id));
    knownIds.current = currentIds;
    if (added.length > 0) {
      setJoiningIds(new Set(added));
      const t = setTimeout(() => setJoiningIds(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [displaySubtasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const requestToggle = (id) => {
    const task = displaySubtasks.find(t => t.id === id);
    const willComplete = task && !task.completed;
    if (!willComplete || localStorage.getItem('orbit-complete-skip') === '1') {
      handleToggle(id);
      return;
    }
    setPendingToggleId(id);
  };

  const confirmToggle = (dontShowAgain) => {
    if (dontShowAgain) localStorage.setItem('orbit-complete-skip', '1');
    handleToggle(pendingToggleId);
    setPendingToggleId(null);
  };

  const handleToggle = async (id) => {
    const task = displaySubtasks.find(t => t.id === id);
    const willComplete = task && !task.completed;

    if (willComplete) {
      const meta = ringAssignments.find(a => a.planet.id === id);
      const escapeRadius = meta ? BASE_RADIUS + meta.ringIndex * RING_GAP : null;

      // Phase 1: accelerate on orbit for 700ms
      setSpeedingIds(prev => new Set([...prev, id]));

      // Phase 2: after speed-up, read live angle and launch tangentially
      setTimeout(() => {
        setSpeedingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        if (escapeRadius !== null) {
          const actualAngle = planetAngleRefs.current[id]?.current ?? 0;
          const rad  = (actualAngle * Math.PI) / 180;
          const x    = arenaHalf + Math.cos(rad) * escapeRadius;
          const y    = arenaHalf + Math.sin(rad) * escapeRadius;
          // Tangential direction (perpendicular to radius) + slight outward bias
          const tanX = -Math.sin(rad);
          const tanY =  Math.cos(rad);
          const radX =  Math.cos(rad);
          const radY =  Math.sin(rad);
          const raw  = { x: tanX * 0.75 + radX * 0.35, y: tanY * 0.75 + radY * 0.35 };
          const len  = Math.sqrt(raw.x * raw.x + raw.y * raw.y);
          setEscapingPlanets(prev => ({
            ...prev,
            [id]: { x, y, dirX: raw.x / len, dirY: raw.y / len },
          }));
        }
      }, 700);
    }

    try {
      await api.patch(`/orbit/subtasks/${id}/toggle`);
      if (willComplete) {
        delete planetMountTime.current[id];
        // Speed-up 700ms + escape 1100ms → then clean up
        setTimeout(() => {
          setEscapingPlanets(prev => { const n = { ...prev }; delete n[id]; return n; });
          setGoneIds(prev => new Set([...prev, id]));
          onUpdate();
        }, 700 + 1100);
      } else {
        setGoneIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        onUpdate();
      }
    }
    catch { toast.error('Failed to update'); }
  };
  const handleDelete = async (id) => {
    try { await api.delete(`/orbit/subtasks/${id}`); setExpandedChild(null); onUpdate(); }
    catch { toast.error('Failed to delete'); }
  };
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await api.post(`/orbit/${node.id}/subtasks`, { title: newTitle.trim() });
      setNewTitle(''); setShowAddForm(false); onUpdate();
    } catch { toast.error('Failed to add'); }
    finally { setAdding(false); }
  };

  if (expandedChild) {
    const childNode = subtasks.find(s => s.id === expandedChild);
    if (childNode) return (
      <OrbitView node={childNode} onClose={() => setExpandedChild(null)}
        onUpdate={onUpdate} depth={depth + 1} />
    );
  }

  // Transform-origin set to card center so the view grows/shrinks from exactly where the card was
  const originX = cardRect ? `${Math.round(cardRect.left + cardRect.width / 2)}px` : '50%';
  const originY = cardRect ? `${Math.round(cardRect.top + cardRect.height / 2)}px` : '50%';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.06 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.05 }}
      style={{ position: 'fixed', inset: 0, zIndex: 50,
        transformOrigin: `${originX} ${originY}`,
        background: T.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Drifting particles */}
      <GalaxyParticles dark={dark} />
      <ShootingStars dark={dark} />

      {/* Decorative concentric rings */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
           preserveAspectRatio="xMidYMid slice">
        {[160, 280, 400, 520].map((r, i) => (
          <circle key={i} cx="50%" cy="50%" r={r}
            fill="none" stroke={T.outerRing(i)}
            strokeWidth={i % 2 === 0 ? 1 : 0.6}
            strokeDasharray={i % 2 === 0 ? '4 14' : '1 20'}
            opacity={0.45 - i * 0.08} />
        ))}
      </svg>

      {/* Close / Back */}
      <button onClick={onClose} style={{ position: 'absolute', top: 24, left: 24, zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 6, background: T.btnBg,
        border: `1px solid ${T.btnBorder}`, borderRadius: 10, padding: '6px 14px',
        fontSize: 13, fontWeight: 600, color: T.btnColor, cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
        <ChevronLeft size={14} />{depth > 0 ? 'Back' : 'Close'}
      </button>

      {/* Dark / Light toggle */}
      <button onClick={() => setDark(d => !d)}
        style={{ position: 'absolute', top: 24, right: 70, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 5, background: T.btnBg,
          border: `1px solid ${T.btnBorder}`, borderRadius: 10, padding: '6px 12px',
          fontSize: 12, fontWeight: 600, color: T.btnColor, cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'background 0.4s, color 0.4s, border-color 0.4s' }}>
        {dark ? <Sun size={13} /> : <Moon size={13} />}
        {dark ? 'Light' : 'Dark'}
      </button>

      {depth > 0 && (
        <div style={{ position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: T.mutedText, letterSpacing: 1, textTransform: 'uppercase', zIndex: 60 }}>
          Nested orbit  level {depth}
        </div>
      )}

      {/* Zoom slider — vertical, right side, translucent until hover */}
      <style>{`
        .zoom-slider-track {
          opacity: 0.28;
          transition: opacity 0.3s ease;
        }
        .zoom-slider-track:hover {
          opacity: 1;
        }
        .orbit-edit-btn {
          opacity: 0.58;
          transition: opacity 0.3s ease;
        }
        .orbit-edit-btn:hover {
          opacity: 1;
        }
        .zoom-range-horiz {
          width: 220px;
          cursor: pointer;
          accent-color: #f97316;
          margin: 0;
          display: block;
        }
      `}</style>
      <div className="zoom-slider-track" style={{
        position: 'absolute', right: 20, top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        background: T.panelBg,
        border: `1px solid ${T.panelBorder}`,
        borderRadius: 20, padding: '16px 12px',
        backdropFilter: 'blur(6px)',
        transition: 'background 0.4s, border-color 0.4s',
      }}>
        <span style={{ fontSize: 10, color: T.panelPct, fontWeight: 600,
          userSelect: 'none', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {Math.round(zoom * 100)}%
        </span>
        {/* Rotate a standard horizontal range input to make a vertical slider */}
        <div style={{ height: 220, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          <input type="range" min={30} max={250} step={5}
            value={Math.round(zoom * 100)}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            className="zoom-range-horiz"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center center' }} />
        </div>
        <span style={{ fontSize: 9, color: T.panelLabel, userSelect: 'none', textTransform: 'uppercase', letterSpacing: 0.5 }}>zoom</span>
      </div>

      {/* Edit orbit button — translucent, solid on hover like zoom slider */}
      <button className="orbit-edit-btn" onClick={() => setEditingCenter(node)}
        style={{
          position: 'absolute', left: 20, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 60,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          background: dark ? 'rgba(28, 22, 17, 0.92)' : 'rgba(255,255,255,0.9)',
          border: dark ? '1px solid rgba(251,146,60,0.45)' : `1px solid ${T.panelBorder}`,
          borderRadius: 20, padding: '14px 14px',
          backdropFilter: 'blur(6px)',
          boxShadow: dark ? '0 0 0 1px rgba(251,146,60,0.2), 0 10px 24px rgba(0,0,0,0.28)' : '0 8px 20px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          transition: 'background 0.4s, border-color 0.4s',
        }}>
        <Pencil size={16} style={{ color: dark ? '#fb923c' : T.panelPct }} />
        <span style={{ fontSize: 10, color: dark ? '#fdba74' : T.panelLabel, userSelect: 'none', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>edit task</span>
      </button>

      {/* Zoomable orbit arena */}
      <div ref={arenaRef} onWheel={handleWheel}
        style={{ width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 1 }}>
        {/* Parallax wrapper — only handles x/y offset */}
        <motion.div style={{ x: px, y: py, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {/* Zoom wrapper — only handles scale */}
          <div style={{ zoom: zoom, flexShrink: 0 }}>

          {/* Arena  all coordinates relative to this div */}
          <div style={{ position: 'relative', width: arenaSize, height: arenaSize }}>

            {/* Rings + progress arcs  use pixel cx/cy so they align with planet CSS positions */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              {Array.from({ length: numRings }).map((_, ri) => {
                const r = BASE_RADIUS + ri * RING_GAP;
                return (
                  <g key={ri}>
                    <circle cx={arenaHalf} cy={arenaHalf} r={r}
                      fill="none" stroke={T.trackBand} strokeWidth="22" />
                    <circle cx={arenaHalf} cy={arenaHalf} r={r}
                      fill="none" stroke={T.trackDash} strokeWidth="1" strokeDasharray="5 14" />
                  </g>
                );
              })}
            </svg>

            {/* Center sphere  positioned with explicit pixel offsets so no CSS transform
                conflict with framer-motion scale animation */}
            <motion.div
              animate={isComplete ? { scale: [1, 1.07, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, type: 'spring' }}
              style={{
                position: 'absolute',
                top: sphereOff,
                left: sphereOff,
                width: SPHERE_SIZE,
                height: SPHERE_SIZE,
                borderRadius: '50%',
                background: isComplete ? '#c2410c' : '#ea580c',
                boxShadow: isComplete
                  ? '0 0 0 6px rgba(249,115,22,0.2), 0 10px 32px rgba(234,88,12,0.35), inset 0 0 24px rgba(0,0,0,0.18)'
                  : 'inset 0 0 20px rgba(0,0,0,0.12), 0 8px 28px rgba(234,88,12,0.22)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                userSelect: 'none', zIndex: 10,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setCenterHovered(true)}
              onMouseLeave={() => setCenterHovered(false)}>
              <p style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.3, textAlign: 'center',
                padding: '0 12px', color: 'rgba(255,255,255,0.95)',
                maxWidth: 96, wordBreak: 'break-word' }}>{node.title}</p>
              {totalLeaves > 0 && (
                <p style={{ fontSize: 9, marginTop: 4,
                  color: 'rgba(255,255,255,0.55)' }}>
                  {doneLeaves}/{totalLeaves}
                </p>
              )}
              <AnimatePresence>
                {centerHovered && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    onClick={(e) => { e.stopPropagation(); setEditingCenter(node); }}
                    style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20,
                      borderRadius: '50%', background: 'rgba(249,115,22,0.9)', color: 'white',
                      border: 'none', cursor: 'pointer', zIndex: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pencil size={10} />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Spinning planets — key = s.id so SpinningOrbit persists across redistribution */}
            <AnimatePresence>
              {ringAssignments
                .filter(({ planet: s }) => !escapingPlanets[s.id])
                .map(({ planet: s, ringIndex, posInRing, ringSize }) => {
                  const r = BASE_RADIUS + ringIndex * RING_GAP;
                  if (!planetAngleRefs.current[s.id]) planetAngleRefs.current[s.id] = { current: 0 };
                  return (
                    <motion.div key={s.id}
                      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                      initial={joiningIds.has(s.id)
                        ? { opacity: 0, scale: 0.15 }
                        : { opacity: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={joiningIds.has(s.id)
                        ? { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }
                        : { duration: 0.01 }}>
                      <div style={{ pointerEvents: speedingIds.has(s.id) ? 'none' : 'auto' }}>
                        <Planet node={s} orbitRadius={r}
                          ringIndex={ringIndex} posInRing={posInRing} ringSize={ringSize}
                          index={0} total={1} spinning={true} zoom={zoom}
                          cx={arenaHalf} cy={arenaHalf}
                          ringStartTime={ringStartTimes.current[ringIndex]}
                          isNew={joiningIds.has(s.id)}
                          speeding={speedingIds.has(s.id)}
                          onToggle={() => requestToggle(s.id)}
                          onDelete={() => handleDelete(s.id)}
                          angleRef={planetAngleRefs.current[s.id]}
                          onExpand={() => hasChildren(s) && setExpandedChild(s.id)} />
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Escape overlays — orange sphere rockets away after spin-up */}
            <AnimatePresence>
              {Object.entries(escapingPlanets).map(([id, { x, y, dirX, dirY }]) => {
                return (
                <motion.div key={`esc-${id}`}
                  style={{
                    position: 'absolute',
                    left: x, top: y,
                    width: 38, height: 38,
                    marginLeft: -19, marginTop: -19,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 30%, #e7e5e4 0%, #b8b4ae 60%)',
                    border: '2px solid #8a8680',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                    zIndex: 30,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: dirX * 800,
                    y: dirY * 800,
                    opacity: 0,
                    scale: 0.4,
                  }}
                  transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
                />
              );})}
            </AnimatePresence>
          </div>
        </div>
        </motion.div>
      </div>

      {/* Status + add subtask  always at bottom of overlay */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%',
        transform: 'translateX(-50%)', zIndex: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <p style={{ fontSize: 12, color: T.mutedText }}>
          {total === 0 ? 'No orbiting tasks yet'
            : isComplete ? ' Complete!'
            : `${doneLeaves} of ${totalLeaves} done`}
        </p>
        <AnimatePresence mode="wait">
          {!showAddForm ? (
            <motion.button key="add-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => setShowAddForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: T.addColor, background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px', borderRadius: 8, transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.color = T.addColor}>
              <Plus size={13} /> Add orbiting task
            </motion.button>
          ) : (
            <motion.form key="add-form" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} onSubmit={handleAddSubtask}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Task name" className="input-field"
                style={{ fontSize: 13, padding: '6px 10px', width: 180 }} />
              <button type="submit" disabled={adding} className="btn-primary"
                style={{ fontSize: 12, padding: '6px 12px' }}>
                {adding ? '…' : 'Add'}
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setNewTitle(''); }}
                style={{ background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {editingSubtask && (
        <AddTaskModal
          initialTask={editingSubtask}
          hideOrbitToggle
          onClose={() => setEditingSubtask(null)}
          onTaskUpdated={() => { setEditingSubtask(null); onUpdate(); }}
        />
      )}
      {editingCenter && (
        <AddTaskModal
          initialTask={editingCenter}
          hideOrbitToggle
          onClose={() => setEditingCenter(null)}
          onTaskUpdated={() => { setEditingCenter(null); onUpdate(); }}
        />
      )}

      {/* Task-completion confirmation dialog */}
      <AnimatePresence>
      {pendingToggleId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setPendingToggleId(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dark ? 'rgba(10,8,7,0.72)' : 'rgba(0,0,0,0.38)',
            backdropFilter: 'blur(4px)',
          }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: dark ? '#1c1917' : '#fff',
              border: `1px solid ${dark ? '#44403c' : '#e5e3de'}`,
              borderRadius: 16,
              padding: '28px 32px',
              maxWidth: 340,
              width: '90%',
              boxShadow: dark ? '0 18px 40px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: dark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={22} color="#f97316" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: dark ? '#f5f5f4' : '#1c1917' }}>
                Mark this task as done?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: dark ? '#c9c3bb' : '#78716c', maxWidth: 240 }}>
                {displaySubtasks.find(t => t.id === pendingToggleId)?.title}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                onClick={() => setPendingToggleId(null)}
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: dark ? '#292524' : '#f5f5f4',
                  border: `1px solid ${dark ? '#57534e' : '#e5e3de'}`,
                  color: dark ? '#e7e5e4' : '#57534e',
                }}>
                Cancel
              </button>
              <button
                onClick={() => confirmToggle(false)}
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: '#f97316', border: 'none', color: 'white',
                }}>
                Mark done
              </button>
            </div>
            <button
              onClick={() => confirmToggle(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: dark ? '#78716c' : '#a8a29e',
                textDecoration: 'underline', padding: 0,
              }}>
              Don't show this again
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Live animated orbit thumbnail ─────────────────────────────────────────── */
function LiveOrbitThumbnail({ activePlanets, size, radius }) {
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const t0Ref        = useRef(Date.now());
  const planetsRef   = useRef(activePlanets);
  planetsRef.current = activePlanets;
  const DUR = RING_DURATIONS[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx  = size / 2;
    const R   = radius;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Dashed orbit ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cx, R, 0, 2 * Math.PI);
      ctx.setLineDash([3, 8]);
      ctx.strokeStyle = '#e5e3de';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Orbiting planets
      const elapsed = (Date.now() - t0Ref.current) / 1000;
      const phase   = ringPhaseAt(elapsed, DUR);
      const pts     = planetsRef.current;
      const n       = pts.length;

      pts.forEach((s, i) => {
        const spacing  = (i / Math.max(n, 1)) * 360;
        const angleDeg = phase + spacing;
        const angleRad = (angleDeg * Math.PI) / 180;
        const px = cx + Math.cos(angleRad) * R;
        const py = cx + Math.sin(angleRad) * R;
        const color = '#b8b4ae'; // moon grey — matches Planet button
        const PR = 9; // planet radius

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur  = 5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;

        ctx.beginPath();
        ctx.arc(px, py, PR, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();

        // Border
        ctx.beginPath();
        ctx.arc(px, py, PR, 0, 2 * Math.PI);
        ctx.strokeStyle = '#8a8680';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []); // setup once — live data read via ref each frame

  return (
    <canvas ref={canvasRef} width={size} height={size}
      style={{ position: 'absolute', inset: 0 }} />
  );
}

/*  Mini orbit card  */
function OrbitCard({ orbit, onExpand, onDelete, onEdit }) {
  const { dark } = useTheme();
  const subtasks    = orbit.subtasks || [];
  const total       = subtasks.length;
  const prog        = completionOf(orbit);
  const doneLeaves  = countDoneLeaves(orbit);
  const totalLeaves = countLeaves(orbit);
  const isComplete  = prog >= 1 && totalLeaves > 0;
  const R    = 62;
  const SIZE = (R + 32) * 2;

  return (
    <motion.div layout
      whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.09)' }}
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onExpand(r); }}
      className="card"
      style={{ padding: '20px 16px 16px', cursor: 'pointer', position: 'relative',
               overflow: 'visible', userSelect: 'none' }}>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ position: 'absolute', top: 10, right: 10, background: 'none',
          border: 'none', cursor: 'pointer', color: '#d6d3d1', transition: 'color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = '#d6d3d1'}>
        <Trash2 size={13} />
      </button>
      <button onClick={e => { e.stopPropagation(); onEdit?.(); }}
        style={{ position: 'absolute', top: 10, right: 32, background: 'none',
          border: 'none', cursor: 'pointer', color: '#d6d3d1', transition: 'color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
        onMouseLeave={e => e.currentTarget.style.color = '#d6d3d1'}>
        <Pencil size={13} />
      </button>

      <div style={{ position: 'relative', width: SIZE, height: SIZE, margin: '0 auto' }}>
        <LiveOrbitThumbnail
          activePlanets={subtasks.filter(s => !s.completed)}
          size={SIZE} radius={R} />
        <div style={{ position: 'absolute', top: SIZE/2 - 26, left: SIZE/2 - 26,
          width: 52, height: 52, borderRadius: '50%',
          background: isComplete
            ? 'radial-gradient(circle at 32% 26%, #fb923c 0%, #c2410c 58%, #7c2d12 100%)'
            : 'radial-gradient(circle at 32% 26%, #fb923c 0%, #ea580c 58%, #9a3412 100%)',
          boxShadow: isComplete
            ? '0 0 0 4px rgba(249,115,22,0.14), 0 4px 14px rgba(234,88,12,0.25)'
            : '0 0 0 3px rgba(249,115,22,0.18), 0 4px 12px rgba(234,88,12,0.3)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600,
        color: dark ? '#f5f5f4' : '#292524',
        marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {orbit.title}
      </p>
      <p style={{ textAlign: 'center', fontSize: 10, color: '#a8a29e', marginTop: 2 }}>
        {total === 0 ? 'Empty  tap to open'
          : isComplete ? ' Complete'
          : `${doneLeaves}/${totalLeaves} done  tap to open`}
      </p>
    </motion.div>
  );
}

/*  Page  */
export default function Orbit() {
  const { dark } = useTheme();
  const [orbits, setOrbits]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openOrbitId, setOpenOrbitId]     = useState(null);
  const [openCardRect, setOpenCardRect]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingOrbit, setEditingOrbit]   = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/orbit');
      setOrbits(res.data);
    } catch { toast.error('Failed to load orbits'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id) => setConfirmDelete(id);

  const confirmDeleteOrbit = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    try { await api.delete(`/orbit/${id}`); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const removeFromOrbitOnly = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.patch(`/tasks/${id}`, { isOrbit: false });
      toast.success('Removed from Orbit and kept in Tasks');
      load();
    } catch {
      toast.error('Failed to update orbit');
    }
  };

  const openOrbit = orbits.find(o => o.id === openOrbitId);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Custom delete confirmation dialog */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 200,
              background: dark ? 'rgba(10,8,7,0.68)' : 'rgba(247,246,243,0.7)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmDelete(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              style={{ background: dark ? '#1c1917' : '#ffffff', borderRadius: 18, padding: '28px 28px 24px',
                maxWidth: 320, width: '90%', textAlign: 'center',
                border: dark ? '1px solid #44403c' : '1px solid #e5e3de',
                boxShadow: dark ? '0 18px 40px rgba(0,0,0,0.45)' : '0 8px 32px rgba(0,0,0,0.1)' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%',
                background: dark ? 'rgba(249,115,22,0.12)' : '#fff7ed', border: dark ? '1.5px solid rgba(251,146,60,0.45)' : '1.5px solid #fed7aa',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 14px' }}>
                <Trash2 size={18} color="#f97316" />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: dark ? '#f5f5f4' : '#1c1917', marginBottom: 6 }}>
                Delete orbit?
              </h3>
              <p style={{ fontSize: 12.5, color: dark ? '#c9c3bb' : '#a8a29e', marginBottom: 22, lineHeight: 1.6 }}>
                Do you also want to delete the task itself?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10,
                    border: dark ? '1.5px solid #57534e' : '1.5px solid #e5e3de', background: dark ? '#292524' : '#fafaf9',
                    fontSize: 13, fontWeight: 600, color: dark ? '#e7e5e4' : '#57534e', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={removeFromOrbitOnly}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10,
                    border: dark ? '1.5px solid rgba(251,146,60,0.45)' : '1.5px solid #fed7aa', background: dark ? 'rgba(249,115,22,0.1)' : '#fff7ed',
                    fontSize: 12.5, fontWeight: 600, color: '#c2410c', cursor: 'pointer' }}>
                  Keep Task
                </button>
                <button onClick={confirmDeleteOrbit}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                    background: '#f97316', fontSize: 13, fontWeight: 600,
                    color: '#fff', cursor: 'pointer' }}>
                  Delete Both
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Orbit</h1>
          <p className="text-stone-400 text-sm mt-0.5">Goal at the center, steps in orbit</p>
        </div>
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} /> New Orbit
        </motion.button>
      </div>

      {/* Orbit explainer */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="card p-4 mb-8"
        style={{ borderLeft: '3px solid #f97316' }}>
        <p className="text-sm text-stone-500 leading-relaxed">
          <span className="font-semibold text-neutral-900">Orbits</span> are your big goals broken into actionable steps.
          Each orbit has a central objective with tasks orbiting around it — complete all the orbiting tasks to achieve your goal.
          Create an orbit when you have a goal that needs multiple steps to accomplish.
        </p>
      </motion.div>

      {orbits.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-20 text-center">
          <div style={{ position: 'relative', width: 130, height: 130, marginBottom: 24 }}>
            <svg width={130} height={130}>
              <circle cx={65} cy={65} r={48} fill="none" stroke="#e5e3de"
                strokeWidth="1" strokeDasharray="3 8" />
            </svg>
            <div style={{ position: 'absolute', top: 65 - 23, left: 65 - 23,
              width: 46, height: 46, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #fafaf9 0%, #d6d3d1 58%, #a8a29e 100%)',
              boxShadow: '0 2px 0 rgba(255,255,255,0.65) inset, 0 4px 12px rgba(0,0,0,0.1)' }} />
            {[0,1,2,3].map(i => {
              const a = (i/4)*2*Math.PI - Math.PI/2;
              return <div key={i} style={{ position: 'absolute',
                top: 65 + Math.sin(a)*48 - 9, left: 65 + Math.cos(a)*48 - 9,
                width: 18, height: 18, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #fafaf9 0%, #e7e5e4 100%)',
                border: '1.5px solid #d6d3d1' }} />;
            })}
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No orbits yet</h3>
          <p className="text-stone-400 text-sm max-w-xs mb-6 leading-relaxed">
            Create an orbit  a central goal surrounded by the steps that bring it to life.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> Create your first orbit
          </button>
        </motion.div>
      )}

      {orbits.length > 0 && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          <AnimatePresence>
            {orbits.map(orbit => (
              <OrbitCard key={orbit.id} orbit={orbit}
                onExpand={rect => { setOpenCardRect(rect); setOpenOrbitId(orbit.id); }}
                onDelete={() => handleDelete(orbit.id)}
                onEdit={() => setEditingOrbit(orbit)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {openOrbit && (
          <OrbitView node={openOrbit}
            cardRect={openCardRect}
            onClose={() => { setOpenOrbitId(null); setOpenCardRect(null); load(); }}
            onUpdate={load} />
        )}
      </AnimatePresence>

      {showCreateModal && (
        <CreateOrbitModal
          onClose={() => setShowCreateModal(false)}
          onOrbitCreated={() => { setShowCreateModal(false); load(); }}
        />
      )}
      {editingOrbit && (
        <AddTaskModal
          initialTask={editingOrbit}
          hideOrbitToggle
          onClose={() => setEditingOrbit(null)}
          onTaskUpdated={() => { setEditingOrbit(null); load(); }}
        />
      )}
    </div>
  );
}