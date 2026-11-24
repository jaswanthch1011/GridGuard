import { useEffect, useState } from 'react';
import { api } from '../lib';
export default function Alerts() {
  const [alerts,setAlerts]=useState([]); useEffect(()=>{ api('/alerts').then(d=>setAlerts(d.alerts||[])).catch(()=>{}); },[]);
  return <div><div className="hero"><div><h1>Alerts & Notifications</h1><p>Abnormal operating conditions, faults, communication failures, and recovery events.</p></div></div>
    <div className="card"><table className="table"><thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Time</th><th>Affected</th><th>Description</th><th>Status</th></tr></thead><tbody>
      {alerts.map(a=><tr key={a.id}><td className="muted">{a.id.slice(0,14)}</td><td>{a.type}</td><td><span className={`badge ${a.severity==='Critical'?'critical':'normal'}`}>{a.severity}</span></td><td>{new Date(a.timestamp).toLocaleString()}</td><td>{a.affectedLoad||'—'}</td><td>{a.description}<div className="muted">{a.recommendedAction}</div></td><td><span className="badge open">{a.status}</span></td></tr>)}
      {!alerts.length&&<tr><td colSpan="7" className="muted">No alerts.</td></tr>}
    </tbody></table></div>
  </div>;
}
