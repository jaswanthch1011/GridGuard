import { useState } from 'react';
import { tierLabel } from '../lib';
export default function Loads({ state, act, canControl }) {
  const loads = state?.loads||[];
  const [form,setForm]=useState({ name:'', nodeId:'', group:'General', ratedW:100, tier:3 });
  const save = async (e)=>{ e.preventDefault(); await act('/loads', form); setForm({ name:'', nodeId:'', group:'General', ratedW:100, tier:3 }); };
  return <div><div className="hero"><div><h1>Load Management</h1><p>Manage loads, categories, rated power, priority, protection, and control permissions.</p></div></div>
    {canControl && <form className="card" style={{marginBottom:16}} onSubmit={save}><h3>Add Load</h3><div className="grid g4">
      <label className="field"><span>Name</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
      <label className="field"><span>Node ID</span><input value={form.nodeId} onChange={e=>setForm({...form,nodeId:e.target.value})} placeholder="esp32-07"/></label>
      <label className="field"><span>Category</span><input value={form.group} onChange={e=>setForm({...form,group:e.target.value})}/></label>
      <label className="field"><span>Rated Power (W)</span><input type="number" value={form.ratedW} onChange={e=>setForm({...form,ratedW:+e.target.value})}/></label>
      <label className="field"><span>Priority</span><select value={form.tier} onChange={e=>setForm({...form,tier:+e.target.value})}><option value={1}>P1 Critical</option><option value={2}>P2 Normal</option><option value={3}>P3 Low</option></select></label>
    </div><button className="btn">Add Load</button></form>}
    <div className="card"><table className="table"><thead><tr><th>Load</th><th>Node</th><th>Category</th><th>Rated</th><th>Priority</th><th>State</th><th>Last Reason</th><th>Actions</th></tr></thead><tbody>
      {loads.map(l=><tr key={l.id}><td><strong>{l.name}</strong></td><td className="muted">{l.nodeId}</td><td>{l.category||l.group}</td><td>{l.ratedW} W</td><td><span className={`badge ${tierLabel(l.tier).toLowerCase()}`}>{tierLabel(l.tier)}</span></td><td><span className={`badge ${l.status==='ON'?'on':l.status==='FAULT'?'fault':'off'}`}>{l.status}</span></td><td className="muted">{l.disconnectReason||'—'}</td><td className="row">{canControl&&<><button className="btn ghost" onClick={()=>act(`/loads/${l.id}`,{override:l.status==='ON'?'off':'auto'},'PATCH')}>{l.status==='ON'?'Off':'Auto'}</button>{l.status==='FAULT'&&<button className="btn ghost" onClick={()=>act(`/loads/${l.id}/reset`,{})}>Reset</button>}</>}</td></tr>)}
    </tbody></table></div>
  </div>;
}
