export default function Events({ events }) {
  const download = () => { const rows=[['time','level','type','loadId','message'], ...events.map(e=>[new Date(e.t).toISOString(),e.level,e.type,e.loadId||'',`"${(e.message||'').replace(/"/g,'""')}"`])]; const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='gridguard-events.csv'; a.click(); };
  return <div><div className="hero"><div><h1>Event History / Logs</h1><p>Chronological record of source changes, shedding, restoration, faults, and operator actions.</p></div><button className="btn ghost" onClick={download}>Export CSV</button></div>
    <div className="card"><table className="table"><thead><tr><th>Time</th><th>Severity</th><th>Type</th><th>Load</th><th>Description</th></tr></thead><tbody>
      {events.map((e,i)=><tr key={i}><td>{new Date(e.t).toLocaleString()}</td><td><span className={`badge ${e.level==='critical'?'critical':e.level==='warn'?'normal':'ok'}`}>{e.level}</span></td><td>{e.type}</td><td>{e.loadId||'—'}</td><td>{e.message}</td></tr>)}
      {!events.length&&<tr><td colSpan="5" className="muted">No events.</td></tr>}
    </tbody></table></div>
  </div>;
}
