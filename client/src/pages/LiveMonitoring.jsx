import Spark, { BigChart } from '../components/Charts.jsx';
export default function LiveMonitoring({ state, history, canControl, act }) {
  const loads = state?.loads||[];
  const chart = history.map(h=>({t:h.t,demand:Math.round(h.totalW),capacity:h.capacityW}));
  return <div><div className="hero"><div><h1>Live Monitoring</h1><p>Real-time telemetry from ESP32 nodes (voltage, current, power, relay state).</p></div></div>
    <div className="grid g4" style={{marginBottom:16}}>
      {['Voltage','Current','Frequency','Power Factor'].map((k,i)=>{ const v=loads[0]?.voltage||229.5; const val=[`${v.toFixed(1)} V`,`${((state?.totalW||0)/Math.max(v,1)).toFixed(2)} A`,`49.9 Hz`,`0.97`][i]; return <div className="card" key={k}><div className="muted">{k}</div><div style={{fontSize:'1.8rem',fontWeight:800,margin:'6px 0'}}>{val}</div><Spark data={history.slice(-50).map((h,idx)=>({value:i===0?229+Math.sin(idx/4):i===1?h.totalW/230:i===2?49.9:0.97}))} /></div>;})}
    </div>
    <div className="card" style={{marginBottom:16}}><h3>Demand / Capacity</h3><BigChart data={chart} lines={[{key:'demand',name:'Demand',color:'#47b892'},{key:'capacity',name:'Capacity',color:'#0f5b66'}]} /></div>
    <div className="card"><h3>Connected Loads</h3><table className="table"><thead><tr><th>Load</th><th>Node</th><th>V</th><th>A</th><th>W</th><th>Relay</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {loads.map(l=><tr key={l.id}><td>{l.name}</td><td className="muted">{l.nodeId}</td><td>{l.voltage?.toFixed?.(1)??'—'}</td><td>{l.current?.toFixed?.(2)??'—'}</td><td>{Math.round(l.power||0)}</td><td>{l.relay}</td><td><span className={`badge ${l.status==='ON'?'on':l.status==='FAULT'?'fault':'off'}`}>{l.status}</span></td><td>{canControl&&<button className="btn ghost" onClick={()=>act(`/loads/${l.id}`,{override:l.override==='on'?'auto':'on'},'PATCH')}>{l.override==='on'?'Auto':'Pin On'}</button>}</td></tr>)}
    </tbody></table></div>
  </div>;
}
