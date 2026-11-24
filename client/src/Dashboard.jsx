import { useMemo, useState } from 'react';
import { TIER } from './lib.js';
import { useGrid } from './useGrid.js';

const STATUS = {
  ON: { label: 'Powered', cls: 'ok' },
  SHED: { label: 'Shed', cls: 'warn' },
  MANUAL_OFF: { label: 'Off (manual)', cls: 'mute' },
  FAULT: { label: 'Fault', cls: 'bad' },
};

const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function PowerChart({ history }) {
  const W = 640, H = 220, P = { l: 44, r: 12, t: 12, b: 22 };
  const pts = history.slice(-120);
  if (pts.length < 2) return <div className="chart-empty">Collecting samples…</div>;
  const yMax = Math.max(...pts.map((p) => Math.max(p.totalW, p.capacityW))) * 1.15;
  const x = (i) => P.l + (i / (pts.length - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - v / yMax) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.totalW).toFixed(1)}`).join('');
  const area = `${line}L${x(pts.length - 1)},${H - P.b}L${x(0)},${H - P.b}Z`;
  const cap = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.capacityW).toFixed(1)}`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((yMax * f) / 50) * 50);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Total power draw versus available capacity over the last two minutes">
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--teal)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid-line" />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="axis">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#ga)" />
      <path d={line} className="line-total" />
      <path d={cap} className="line-cap" />
      <text x={W - P.r} y={H - 4} textAnchor="end" className="axis">last {pts.length}s · W</text>
    </svg>
  );
}

function LoadCard({ l, actions, notify, sim }) {
  const st = STATUS[l.status];
  const run = (fn, ok) => fn().then(() => ok && notify(ok)).catch((e) => notify(e.message, true));
  return (
    <article className={`lcard glass st-${st.cls} ${l.offline ? 'offline' : ''}`} style={{ '--tc': TIER[l.tier].color }}>
      <header>
        <div>
          <h3>{l.name}</h3>
          <small className="mono">{l.nodeId} · {l.group}</small>
        </div>
        <span className={`badge ${st.cls}`}>{l.offline ? 'Node offline' : st.label}{l.pending ? ' …' : ''}</span>
      </header>

      <div className="meter" aria-hidden="true"><i style={{ width: `${Math.min((l.power / (l.ratedW * 1.3)) * 100, 100)}%` }} /></div>
      <dl className="readings mono">
        <div><dt>V</dt><dd>{l.voltage.toFixed(1)}</dd></div>
        <div><dt>A</dt><dd>{l.current.toFixed(2)}</dd></div>
        <div><dt>W</dt><dd>{Math.round(l.power)}</dd></div>
      </dl>

      {l.status === 'FAULT' && (
        <div className="fault">
          <strong>{l.faultType?.replace('_', ' ')}</strong>
          <button className="btn btn-sm" onClick={() => run(() => actions.resetLoad(l.id), `${l.name} fault reset`)}>Reset fault</button>
        </div>
      )}

      <div className="controls">
        <label>
          Priority
          <select value={l.tier} onChange={(e) => run(() => actions.patchLoad(l.id, { tier: Number(e.target.value) }), `${l.name} is now Tier ${e.target.value}`)}>
            {[1, 2, 3].map((t) => <option key={t} value={t}>Tier {t} · {TIER[t].name}</option>)}
          </select>
        </label>
        <div className="seg" role="radiogroup" aria-label={`${l.name} control mode`}>
          {[['auto', 'Auto'], ['on', 'Pin on'], ['off', 'Off']].map(([v, n]) => (
            <button key={v} role="radio" aria-checked={l.override === v} className={l.override === v ? 'on' : ''} disabled={l.status === 'FAULT'} onClick={() => run(() => actions.patchLoad(l.id, { override: v }))}>{n}</button>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { state, connected, history, events, analytics, actions } = useGrid();
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [custom, setCustom] = useState(900);
  const [fault, setFault] = useState({ loadId: 'ev', type: 'surge' });

  const notify = (msg, error = false) => {
    setToast({ msg, error, k: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.k >= 2900 ? null : t)), 3000);
  };
  const visible = useMemo(() => (filter === 'all' ? events : events.filter((e) => e.level === filter)), [events, filter]);

  if (!state) {
    return (
      <section className="section dash">
        <div className="glass offline-card" role="status">
          <span className="eyebrow">{connected ? 'Connecting' : 'Backend not reachable'}</span>
          <h2>{connected ? 'Waiting for first reading…' : 'The dashboard needs the GridGuard server.'}</h2>
          {!connected && <p>Start it with <code>npm run dev</code> (or <code>npm start</code> after <code>npm run build</code>) from the project root. This page shows only live data from the backend and never fabricates readings.</p>}
        </div>
      </section>
    );
  }

  const ds = state.dataSource;
  const shed = state.loads.filter((l) => l.status === 'SHED' || l.status === 'MANUAL_OFF').length;
  const faults = state.loads.filter((l) => l.status === 'FAULT').length;
  const util = Math.round((state.totalW / state.capacityW) * 100);
  const maxE = Math.max(1, ...(analytics?.loads.map((l) => l.energyWh) ?? [1]));
  const sources = [['GRID', 'Utility grid'], ['DEGRADED', 'Degraded'], ['BACKUP', 'Backup gen'], ['CUSTOM', 'Custom']];

  return (
    <section className="section dash">
      <div className="dash-head">
        <div>
          <span className="eyebrow">Operations console</span>
          <h1>Live grid</h1>
        </div>
        <div className="status-row">
          <span className={`pill ${connected ? 'pill-ok' : 'pill-warn'}`}>{connected ? 'Stream live' : 'Reconnecting…'}</span>
          {ds.simulator && <span className="pill">Simulated nodes</span>}
          {ds.mqtt && <span className={`pill ${ds.mqtt.connected ? 'pill-ok' : 'pill-warn'}`}>MQTT {ds.mqtt.connected ? 'connected' : 'down'}</span>}
          <span className="pill">DB: {ds.database}</span>
        </div>
      </div>

      {state.criticalOverload && <div className="alert bad" role="alert">Critical overload: only pinned loads remain and they still exceed available power.</div>}
      {state.overloaded && !state.criticalOverload && <div className="alert warn" role="status">Overload handling active. Lower-priority loads are shed until supply balances.</div>}

      <div className="kpis">
        <div className="kpi glass"><span>Available</span><strong className="mono">{state.capacityW}<small>W</small></strong><em>{state.sourceLabel}</em></div>
        <div className="kpi glass"><span>Drawing</span><strong className="mono">{Math.round(state.totalW)}<small>W</small></strong><div className="bar"><i className={util > 100 ? 'over' : ''} style={{ width: `${Math.min(util, 100)}%` }} /></div></div>
        <div className="kpi glass"><span>Headroom</span><strong className={`mono ${state.headroomW < 0 ? 'neg' : ''}`}>{Math.round(state.headroomW)}<small>W</small></strong><em>{util}% utilised</em></div>
        <div className="kpi glass"><span>Shed / Faults</span><strong className="mono">{shed}<small> / {faults}</small></strong><em>{state.loads.length} loads monitored</em></div>
      </div>

      <div className="panel glass">
        <div className="panel-head">
          <h2>Supply source</h2>
          <div className="seg" role="radiogroup" aria-label="Supply source">
            {sources.map(([m, n]) => (
              <button key={m} role="radio" aria-checked={state.mode === m} className={state.mode === m ? 'on' : ''}
                onClick={() => actions.setSource(m, m === 'CUSTOM' ? custom : undefined).then(() => notify(`Supply set to ${n}`)).catch((e) => notify(e.message, true))}>{n}</button>
            ))}
          </div>
        </div>
        {state.mode === 'CUSTOM' && (
          <label className="slider">
            <span>Custom limit</span>
            <input type="range" min="200" max="2000" step="10" value={custom} onChange={(e) => setCustom(+e.target.value)}
              onPointerUp={() => actions.setSource('CUSTOM', custom).catch((e) => notify(e.message, true))}
              onKeyUp={() => actions.setSource('CUSTOM', custom).catch((e) => notify(e.message, true))} />
            <output>{custom} W</output>
          </label>
        )}
        <PowerChart history={history} />
        <div className="legend"><span><i className="sw total" />Total draw</span><span><i className="sw cap" />Available capacity</span></div>
      </div>

      <h2 className="sub">Loads</h2>
      <div className="lgrid">
        {state.loads.map((l) => <LoadCard key={l.id} l={l} actions={actions} notify={notify} sim={ds.simulator} />)}
      </div>

      <div className="two">
        <div className="panel glass">
          <div className="panel-head">
            <h2>Event log</h2>
            <div className="seg" role="radiogroup" aria-label="Filter events">
              {['all', 'info', 'warn', 'critical'].map((f) => (
                <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
          <ul className="log" aria-live="polite">
            {visible.length === 0 && <li className="empty">No events for this filter yet.</li>}
            {visible.slice(0, 60).map((e, i) => (
              <li key={`${e.t}-${i}`} className={`lv-${e.level}`}>
                <time className="mono">{fmtTime(e.t)}</time>
                <b>{e.type.replace(/_/g, ' ')}</b>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="stack">
          <div className="panel glass">
            <h2>Energy analytics</h2>
            {analytics ? (
              <>
                <div className="an-kpis">
                  <div><strong className="mono">{analytics.totalEnergyWh.toFixed(1)}</strong><span>Wh consumed</span></div>
                  <div><strong className="mono">{analytics.totalAvoidedWh.toFixed(1)}</strong><span>Wh avoided by shedding</span></div>
                  <div><strong className="mono">{analytics.totalShedEvents}</strong><span>shed events</span></div>
                </div>
                <ul className="bars">
                  {analytics.loads.map((l) => (
                    <li key={l.id} style={{ '--tc': TIER[l.tier].color }}>
                      <span>{l.name}</span>
                      <div><i style={{ width: `${(l.energyWh / maxE) * 100}%` }} /></div>
                      <em className="mono">{l.energyWh.toFixed(1)} Wh</em>
                    </li>
                  ))}
                </ul>
                <small className="muted">Counted since the server started ({new Date(analytics.since).toLocaleTimeString()}).</small>
              </>
            ) : <p className="muted">Loading…</p>}
          </div>

          {ds.simulator && (
            <div className="panel glass">
              <h2>Fault injection</h2>
              <p className="muted">Simulator only. Break a node and watch detection, tripping and verification.</p>
              <div className="inject">
                <select aria-label="Load" value={fault.loadId} onChange={(e) => setFault({ ...fault, loadId: e.target.value })}>
                  {state.loads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select aria-label="Fault type" value={fault.type} onChange={(e) => setFault({ ...fault, type: e.target.value })}>
                  <option value="surge">Overcurrent surge</option>
                  <option value="undervolt">Undervoltage</option>
                  <option value="stuck">Stuck relay</option>
                  <option value="silent">Node goes silent</option>
                </select>
                <button className="btn btn-sm" onClick={() => actions.inject(fault.loadId, fault.type).then(() => notify('Fault injected')).catch((e) => notify(e.message, true))}>Inject</button>
                <button className="btn btn-sm btn-ghost" onClick={() => actions.clearFaults().then(() => notify('Injected faults cleared')).catch((e) => notify(e.message, true))}>Clear all</button>
              </div>
              {Object.keys(state.faults || {}).length > 0 && <p className="muted mono">Active: {Object.entries(state.faults).map(([n, t]) => `${n}:${t}`).join(', ')}</p>}
            </div>
          )}
        </div>
      </div>

      {toast && <div className={`toast ${toast.error ? 'err' : ''}`} role="status" key={toast.k}>{toast.msg}</div>}
    </section>
  );
}
