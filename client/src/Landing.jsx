import { useEffect, useRef, useState } from 'react';
import { TIER, allocate, useCountUp, useInView, useReducedMotion } from './lib.js';

const DEMO_LOADS = [
  { id: 'icu', name: 'ICU Ventilator', tag: 'Hospital', tier: 1, w: 180 },
  { id: 'servers', name: 'Server Rack', tag: 'Data', tier: 1, w: 220 },
  { id: 'security', name: 'Security & CCTV', tag: 'Security', tier: 1, w: 90 },
  { id: 'cold', name: 'Cold Storage', tag: 'Medical', tier: 2, w: 150 },
  { id: 'hvac', name: 'Office HVAC', tag: 'Comfort', tier: 3, w: 300 },
  { id: 'ev', name: 'EV Charger', tag: 'Mobility', tier: 3, w: 350 },
  { id: 'deco', name: 'Decorative Lighting', tag: 'Ambience', tier: 3, w: 120 },
];
const TOTAL = DEMO_LOADS.reduce((s, l) => s + l.w, 0);
const MAX = 1500;

function Dial({ supply, used }) {
  const R = 96;
  const C = 2 * Math.PI * R;
  const arc = 0.75; // 270deg gauge
  const seg = (v) => C * arc * Math.min(v / MAX, 1);
  return (
    <svg className="dial" viewBox="0 0 240 240" role="img" aria-label={`Supply ${supply} watts, consumption ${used} watts`}>
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--teal)" />
          <stop offset="1" stopColor="var(--amber)" />
        </linearGradient>
      </defs>
      <g transform="rotate(135 120 120)">
        <circle cx="120" cy="120" r={R} className="dial-track" strokeDasharray={`${C * arc} ${C}`} />
        <circle cx="120" cy="120" r={R} className="dial-used" strokeDasharray={`${seg(used)} ${C}`} />
        <circle cx="120" cy="120" r={R + 14} className="dial-supply" strokeDasharray={`${(C + 14 * 2 * Math.PI) * arc * Math.min(supply / MAX, 1)} ${C * 2}`} />
      </g>
      <text x="120" y="112" textAnchor="middle" className="dial-big">{used}</text>
      <text x="120" y="136" textAnchor="middle" className="dial-sub">W drawn</text>
      <text x="120" y="168" textAnchor="middle" className="dial-cap">of {supply} W available</text>
    </svg>
  );
}

function BrownoutDemo() {
  const reduced = useReducedMotion();
  const [supply, setSupply] = useState(MAX);
  const raf = useRef();
  const { on, used } = allocate(DEMO_LOADS, supply);
  const shedCount = DEMO_LOADS.length - on.size;

  const animateTo = (target) => {
    cancelAnimationFrame(raf.current);
    if (reduced) return setSupply(target);
    const from = supply;
    const t0 = performance.now();
    const dur = 1600;
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      setSupply(Math.round(from + (target - from) * e));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const scenarios = [
    ['Utility grid', 1500],
    ['Degraded feed', 1000],
    ['Backup generator', 650],
    ['Critical only', 490],
  ];

  return (
    <div className="demo glass" id="demo-panel">
      <div className="demo-head">
        <div>
          <span className="eyebrow">Interactive model · runs in your browser</span>
          <h3>Drag the supply. Watch priorities hold.</h3>
        </div>
        <span className={`pill ${shedCount ? 'pill-warn' : 'pill-ok'}`} aria-live="polite">
          {shedCount ? `${shedCount} load${shedCount > 1 ? 's' : ''} shed` : 'All loads powered'}
        </span>
      </div>

      <div className="demo-body">
        <div className="dial-wrap">
          <Dial supply={supply} used={used} />
          <label className="slider">
            <span>Available power</span>
            <input type="range" min="300" max={MAX} step="10" value={supply} onChange={(e) => { cancelAnimationFrame(raf.current); setSupply(+e.target.value); }} aria-valuetext={`${supply} watts`} />
            <output>{supply} W</output>
          </label>
          <div className="chips" role="group" aria-label="Supply scenarios">
            {scenarios.map(([n, v]) => (
              <button key={n} className={`chip ${supply === v ? 'active' : ''}`} onClick={() => animateTo(v)}>{n}</button>
            ))}
          </div>
        </div>

        <ul className="demo-loads" aria-label="Loads by priority">
          {DEMO_LOADS.map((l) => {
            const live = on.has(l.id);
            return (
              <li key={l.id} className={`dl ${live ? 'live' : 'shed'}`} style={{ '--tc': TIER[l.tier].color }}>
                <span className="dl-dot" />
                <div className="dl-main">
                  <strong>{l.name}</strong>
                  <small>Tier {l.tier} · {TIER[l.tier].name}</small>
                </div>
                <span className="mono dl-w">{live ? `${l.w} W` : 'SHED'}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="demo-note">Same strict-priority rule as the backend engine: higher tiers are never starved to keep lower tiers on. Total connected demand: {TOTAL} W.</p>
    </div>
  );
}

const STEPS = [
  { k: 'Sense', t: 'Every node reports every second', d: 'ESP32 nodes read voltage and current on each load and publish them over MQTT. The backend derives real power per load and the total against the live supply limit.', code: 'gridguard/esp32-05/telemetry\n{"voltage":229.8,"current":1.12,"relay":"ON"}' },
  { k: 'Prioritize', t: 'Critical loads are not negotiable', d: 'Each load carries a tier: Critical, Essential or Non-critical. Operators can re-tier loads or pin one on, and the engine honours it.', code: 'tier 1  ICU · servers · security\ntier 2  cold storage\ntier 3  HVAC · EV · decor' },
  { k: 'Shed', t: 'Lowest priority goes first', d: 'When demand exceeds available power, the engine sheds Tier 3 before Tier 2, largest first, and stops as soon as the budget balances.', code: 'LOAD_SHED  EV Charger (Tier 3, 346 W)\ndemand 1180 W > 650 W' },
  { k: 'Verify', t: 'A relay command is not proof', d: 'After every OFF command the engine waits for current to fall to zero. If it does not, it retries once, then flags a stuck relay as a fault.', code: 'SHED_VERIFIED  current 0.01 A\nRELAY_STUCK    retry failed' },
  { k: 'Restore', t: 'Power returns in order, with margin', d: 'When headroom appears, the highest-priority shed load returns first, only if it fits with a safety margin, so the system does not flap.', code: 'LOAD_RESTORED  Cold Storage\n610 W + ~120 W fits 92% of 800 W' },
];

function Loop() {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number(e.target.dataset.i))),
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <section id="loop" className="section loop">
      <div className="loop-side">
        <span className="eyebrow">The control loop</span>
        <h2>Five verbs.<br />One resilient grid.</h2>
        <ol className="rail" aria-label="Loop stages">
          {STEPS.map((s, i) => (
            <li key={s.k} className={i === active ? 'on' : i < active ? 'past' : ''}>
              <button onClick={() => refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{s.k}</button>
            </li>
          ))}
        </ol>
      </div>
      <div className="loop-steps">
        {STEPS.map((s, i) => (
          <article key={s.k} ref={(el) => (refs.current[i] = el)} data-i={i} className={`step glass ${i === active ? 'on' : ''}`}>
            <span className="step-n mono">0{i + 1}</span>
            <h3>{s.k}: {s.t}</h3>
            <p>{s.d}</p>
            <pre className="mono">{s.code}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}

const STACK = [
  { n: 'ESP32 nodes', d: 'Voltage sensor + current sensor + relay per load. Publish telemetry, obey commands.', i: '◉' },
  { n: 'MQTT broker', d: 'Lightweight pub/sub transport. Telemetry up, relay commands down, QoS 1.', i: '⇄' },
  { n: 'Node + Express', d: 'Priority engine, fault detection, verification, REST API and Socket.IO stream.', i: '⚙' },
  { n: 'MongoDB', d: 'Event log, power samples and operator configuration. Falls back to memory if absent.', i: '▤' },
  { n: 'React console', d: 'Live monitoring, load control, analytics and event history.', i: '◧' },
];

function Stack() {
  const [sel, setSel] = useState(2);
  return (
    <section id="stack" className="section">
      <span className="eyebrow">Architecture</span>
      <h2>From a current clamp<br />to a decision, in a second.</h2>
      <div className="flow" role="tablist" aria-label="System components">
        {STACK.map((s, i) => (
          <div key={s.n} className="flow-item">
            <button role="tab" aria-selected={sel === i} className={`node glass ${sel === i ? 'sel' : ''}`} onClick={() => setSel(i)}>
              <span className="node-i">{s.i}</span>
              <span>{s.n}</span>
            </button>
            {i < STACK.length - 1 && <span className="wire" aria-hidden="true"><b /></span>}
          </div>
        ))}
      </div>
      <p className="flow-desc glass" role="tabpanel" aria-live="polite">{STACK[sel].d}</p>
    </section>
  );
}

function Stats() {
  const [ref, seen] = useInView();
  const a = useCountUp(1, seen);
  const b = useCountUp(7, seen);
  const c = useCountUp(3, seen);
  const d = useCountUp(4, seen);
  return (
    <section className="stats" ref={ref}>
      {[[a, 's', 'telemetry interval'], [b, '', 'monitored loads'], [c, '', 'priority tiers'], [d, 's', 'verify window']].map(([v, u, l]) => (
        <div key={l} className="stat glass"><strong className="mono">{v}{u}</strong><span>{l}</span></div>
      ))}
    </section>
  );
}

export default function Landing() {
  return (
    <>
      <section className="hero section">
        <div className="hero-copy">
          <span className="eyebrow pulse">Web + IoT · smart power management</span>
          <h1>Power gets scarce.<br /><span className="grad">Priorities don’t.</span></h1>
          <p className="lede">GridGuard Mini senses every load, ranks it, sheds the lowest priority when supply drops, verifies the relay really opened, and restores in order when power returns.</p>
          <div className="cta">
            <a className="btn" href="#/dashboard">Open live dashboard</a>
            <a className="btn btn-ghost" href="#demo" onClick={(e) => { e.preventDefault(); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }); }}>Try the brownout model</a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit o1"><i /></div>
          <div className="orbit o2"><i /></div>
          <div className="core"><svg viewBox="0 0 32 32" width="56" height="56"><path d="M18 4 8 18h7l-1 10 10-14h-7z" fill="currentColor" /></svg></div>
        </div>
      </section>
      <Stats />
      <section id="demo" className="section"><BrownoutDemo /></section>
      <Loop />
      <section className="section tiers">
        <span className="eyebrow">Priority tiers</span>
        <h2>Who keeps the lights on.</h2>
        <div className="tier-grid">
          {[
            [1, 'Critical', 'Hospital equipment, servers, security. Shed last, only after every lower tier is gone. Pin one ON to exempt it entirely.'],
            [2, 'Essential', 'Cold storage and similar. Held until only critical loads can fit.'],
            [3, 'Non-critical', 'HVAC, EV charging, decorative lighting. First to go, last to return.'],
          ].map(([t, n, d]) => (
            <article key={t} className="tier glass" style={{ '--tc': TIER[t].color }}>
              <span className="tier-n mono">T{t}</span>
              <h3>{n}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section final glass">
        <h2>See it run against a live backend.</h2>
        <p>The dashboard streams real engine state over WebSocket. Inject a surge or a stuck relay and watch detection, shedding and verification play out.</p>
        <a className="btn" href="#/dashboard">Open live dashboard</a>
      </section>
    </>
  );
}
