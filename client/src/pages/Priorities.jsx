import { tierLabel } from '../lib';
export default function Priorities({ state, act, canControl }) {
  const loads=[...(state?.loads||[])].sort((a,b)=>a.tier-b.tier||a.name.localeCompare(b.name));
  const setTier = (id,t)=> act(`/loads/${id}`,{tier:t},'PATCH');
  return <div><div className="hero"><div><h1>Priority Management</h1><p>Configure load-shedding order. Lower-priority/eligible loads are considered first when demand exceeds capacity.</p></div></div>
    <div className="card"><table className="table"><thead><tr><th>Rank/Load</th><th>Current Tier</th><th>Power</th><th>Critical Protection</th><th>Set Priority</th></tr></thead><tbody>
      {loads.map((l,i)=><tr key={l.id}><td><strong>{i+1}. {l.name}</strong><div className="muted">{l.category||l.group}</div></td><td><span className={`badge ${tierLabel(l.tier).toLowerCase()}`}>{tierLabel(l.tier)}</span></td><td>{Math.round(l.power)} / {l.ratedW} W</td><td>{l.criticalProtected?'Protected':'Normal'}</td><td>{canControl ? <div className="row">{[1,2,3].map(t=><button key={t} className={`pill ${l.tier===t?'active':''}`} onClick={()=>setTier(l.id,t)}>P{t}</button>)}</div> : '—'}</td></tr>)}
    </tbody></table></div>
  </div>;
}
