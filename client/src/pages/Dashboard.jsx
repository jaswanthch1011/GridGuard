import { Activity, Bolt, Gauge, Leaf } from 'lucide-react';
import { fmtW, tierLabel } from '../lib';
import Spark, { BigChart } from '../components/Charts.jsx';

function Stat({ icon:Icon, label, value, sub, tone='tealbg' }) {
  return <div className="card stat"><div><div className="label">{label}</div><div className="value">{value}</div><div className="sub">{sub}</div></div><div className={`stat-icon ${tone}`}><Icon size={22}/></div></div>;
}

export default function Dashboard({ grid, history, events, act, canControl, range, setRange }) {
  const state = grid?.state; const loads = state?.loads||[];
  const total = state?.totalW||0; const cap = state?.capacityW||1500; const energy = grid?.analytics?.totalEnergyWh||0; const saved = Math.round((grid?.analytics?.totalAvoidedWh||0));
  const active = loads.filter(l=>l.status==='ON').length;
  const filtered = loads; // top summary
  const recent = events.slice(0,6);
  const shedActive = loads.some(l=>l.status==='SHED');
  const chart = history.map(h=>({t:h.t, demand:Math.round(h.totalW), capacity:h.capacityW}));
  return <div>
    <div className="hero">
      <div><h1>Welcome back, {grid?.userName||'Operator'}</h1><p>Real-time monitoring · {state?.overloaded?'Power shortage handling active':'System operating normally'} · {state?.dataSource?.simulator?'Simulated nodes':'Hardware mode'}</p></div>
      <div className="filters">{['Real-Time','24h','7 Days','30 Days'].map(r=><button key={r} className={`pill ${range===r?'active':''}`} onClick={()=>setRange(r)}>{r}</button>)}</div>
    </div>

    <div className="grid g4" style={{marginBottom:16}}>
      <Stat icon={Bolt} label="Total Power Demand" value={fmtW(total)} sub={`${active} active loads`} tone="tealbg" />
      <Stat icon={Gauge} label="Available Power" value={fmtW(cap)} sub={`Headroom ${fmtW(Math.max(0,cap-total))}`} tone="good" />
      <Stat icon={Activity} label="System Status" value={state?.criticalOverload?'Critical':state?.overloaded?'Managing':'Normal'} sub={state?.overloaded?'Load shedding may apply':'All essential loads powered'} tone={state?.criticalOverload?'warnbg':state?.overloaded?'warnbg':'good'} />
      <Stat icon={Leaf} label="Energy Saved" value={`${saved} Wh`} sub="Avoided by intelligent shedding" tone="good" />
    </div>

    <div className="grid g12" style={{marginBottom:16}}>
      <div className="card">
        <h3>Grid Overview</h3>
        <div className="diagram">
          <div className="node source">Grid Source<br/><span className="muted">230V · {fmtW(cap)}</span></div>
          <svg className="wires" viewBox="0 0 760 34"><path d="M380 0 L380 16 M80 16 L680 16 M80 16 L80 34 M220 16 L220 34 M360 16 L360 34 M500 16 L500 34 M680 16 L680 34" stroke="#47b892" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>
          <div className="node ctrl">ESP32 Controller<br/><span className="muted">MQTT / Socket.IO</span></div>
          <svg className="wires" viewBox="0 0 760 34"><path d="M380 0 L380 16 M80 16 L680 16 M80 16 L80 34 M230 16 L230 34 M380 16 L380 34 M530 16 L530 34 M680 16 L680 34" stroke="#47b892" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>
          <div className="loads-row">
            {loads.slice(0,6).map(l=><div key={l.id} className={`load-node ${l.status==='ON'?'':'off'}`}><span className="status-dot"/>{l.name}<div className="muted">{Math.round(l.power)} W · {l.status}</div></div>)}
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Live Readings</h3>
        {(()=>{ const v=loads[0]?.voltage||229.5; const i=(total/Math.max(v,1)); const f=49.9; return <div className="stack">
          <div><div className="reading"><span className="muted">Voltage</span><strong>{v.toFixed(1)} V</strong></div><Spark data={history.slice(-40).map((h,idx)=>({value:229+Math.sin(idx/5)*1.5}))} dataKey="value" color="#47b892"/></div>
          <div><div className="reading"><span className="muted">Current</span><strong>{i.toFixed(2)} A</strong></div><Spark data={history.slice(-40).map(h=>({value:h.totalW/230}))} dataKey="value" color="#79d7b5"/></div>
          <div><div className="reading"><span className="muted">Frequency</span><strong>{f.toFixed(1)} Hz</strong></div><Spark data={history.slice(-40).map((_,idx)=>({value:49.8+Math.sin(idx/7)*0.2}))} dataKey="value" color="#0f5b66"/></div>
        </div>; })()}
      </div>
    </div>

    <div className="grid g2">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}><h3>Load Control</h3><div className="tabs"><button className="pill active">All Loads</button><button className="pill">Critical</button><button className="pill">Non-Critical</button></div></div>
        <table className="table"><thead><tr><th>Load</th><th>Power</th><th>Priority</th><th>Status</th><th>Control</th></tr></thead><tbody>
          {loads.map(l=><tr key={l.id}><td><strong>{l.name}</strong><div className="muted">{l.category||l.group}</div></td><td>{Math.round(l.power)} W</td><td><span className={`badge ${tierLabel(l.tier).toLowerCase()}`}>{tierLabel(l.tier)}</span></td><td><span className={`badge ${l.status==='ON'?'on':l.status==='FAULT'?'fault':'off'}`}>{l.status}</span></td><td><button className={`switch ${l.status==='ON'?'on':''}`} disabled={!canControl || l.status==='FAULT'} onClick={()=>act(`/loads/${l.id}`,{override:l.status==='ON'?'off':'on'},'PATCH')}><i/></button></td></tr>)}
        </tbody></table>
      </div>
      <div className="stack">
        <div className="card"><h3>Load Shedding Status</h3><div className={`badge ${shedActive||state?.overloaded?'fault':'ok'}`} style={{fontSize:'.9rem',padding:'8px 12px'}}>{shedActive||state?.overloaded?'Load shedding active':'No Load Shedding Active'}</div><p className="muted" style={{marginTop:10}}>{shedActive?`${loads.filter(l=>l.status==='SHED').length} non-essential load(s) disconnected to protect capacity.`:'All essential loads are currently powered. Lower-priority loads will disconnect automatically during shortage.'}</p></div>
        <div className="card"><h3>Recent Events</h3><div className="stack">{recent.map((e,i)=><div key={i} className="event"><div className="event-time">{new Date(e.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div><div className="event-dot" style={{background:e.level==='critical'?'var(--bad)':e.level==='warn'?'var(--warn)':'var(--good)'}}/><div><div>{e.message}</div><div className="muted" style={{fontSize:'.82rem'}}>{e.type}</div></div></div>)}{!recent.length&&<div className="muted">No events yet.</div>}</div></div>
      </div>
    </div>
    <div className="card" style={{marginTop:16}}><h3>Power Demand vs Available Capacity</h3><BigChart data={chart} lines={[{key:'demand',name:'Demand (W)',color:'#47b892'},{key:'capacity',name:'Capacity (W)',color:'#0f5b66'}]} /></div>
  </div>;
}
