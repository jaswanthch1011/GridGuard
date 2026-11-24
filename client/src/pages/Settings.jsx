import { useEffect, useState } from 'react';
import { api } from '../lib';
export default function Settings({ canAdmin }) {
  const [s,setS]=useState(null); const [users,setUsers]=useState([]); useEffect(()=>{ api('/settings').then(d=>setS(d.settings)).catch(()=>{}); if(canAdmin) api('/users').then(d=>setUsers(d.users||[])).catch(()=>{}); },[canAdmin]);
  const save=async()=>{ await api('/settings',{method:'PATCH',body:JSON.stringify(s)}); };
  if(!s) return <div className="card">Loading...</div>;
  return <div><div className="hero"><div><h1>System Settings</h1><p>Power management thresholds, communication, and user administration.</p></div>{canAdmin&&<button className="btn" onClick={save}>Save Settings</button>}</div>
    <div className="grid g2">
      <div className="card"><h3>Power Management</h3>{[['maxSource','Maximum source capacity (W)'],['overloadThreshold','Overload threshold (%)'],['minReserve','Minimum reserve (W)'],['restoreDelay','Restore delay (s)']].map(([k,label])=><label key={k} className="field"><span>{label}</span><input type="number" value={s[k]??''} onChange={e=>setS({...s,[k]:+e.target.value})}/></label>)}</div>
      <div className="card"><h3>User Management</h3>{canAdmin ? <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{users.map(u=><tr key={u._id||u.id}><td>{u.name}</td><td>{u.email}</td><td><span className="badge normal">{u.role}</span></td></tr>)}</tbody></table> : <div className="muted">Administrator role required.</div>}</div>
    </div>
  </div>;
}
