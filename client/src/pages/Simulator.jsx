import { useState } from 'react';
export default function Simulator({ state, act }) {
  const [cap,setCap]=useState(900); const [result,setResult]=useState(null);
  const run = async (scenario, value=cap)=>{ setCap(value); const r=await act('/simulate',{capacityW:value, scenario}); setResult(r); };
  const scenarios=[['Normal',1500],['Minor shortage',1100],['Major shortage',700],['Low capacity',450],['Complete failure',100]];
  return <div><div className="hero"><div><h1>Power Failure Simulator</h1><p>Simulate source capacity changes and inspect the load-shedding decision. Hardware mode sends commands to ESP32 nodes.</p></div></div>
    <div className="grid g2">
      <div className="card"><h3>Controls</h3>
        <label className="field"><span>Available power: {cap} W</span><input type="range" min="100" max="2000" value={cap} onChange={e=>setCap(+e.target.value)} /></label>
        <div className="row" style={{flexWrap:'wrap'}}>{scenarios.map(([n,v])=><button key={n} className="pill" onClick={()=>run(n,v)}>{n} ({v}W)</button>)}<button className="btn" onClick={()=>run('Custom',cap)}>Run Simulation</button><button className="btn ghost" onClick={()=>run('Reset',1500)}>Reset</button></div>
        <div className="muted" style={{marginTop:10}}>Current mode: {state?.dataSource?.simulator?'Software/Hardware demonstration via simulator':'Hardware-capable backend'}</div>
      </div>
      <div className="card"><h3>Simulation Output</h3>{result ? <div className="stack">
        <div className="row" style={{justifyContent:'space-between'}}><span className="muted">Available capacity</span><strong>{result.capacityW} W</strong></div>
        <div className="row" style={{justifyContent:'space-between'}}><span className="muted">Total demand</span><strong>{result.totalDemand} W</strong></div>
        <div className="row" style={{justifyContent:'space-between'}}><span className="muted">Power deficit</span><strong>{result.deficit} W</strong></div>
        <div><div className="muted" style={{marginBottom:6}}>Shedding sequence</div>{result.sheddingSequence.length?result.sheddingSequence.map((s,i)=><div key={i} className="badge off" style={{margin:'0 6px 6px 0'}}>{i+1}. {s.name} (P{s.tier}, {s.power}W)</div>):<span className="badge ok">No shedding required</span>}</div>
        <p className="muted">{result.explanation}</p>
      </div> : <div className="muted">Run a scenario to see the decision explanation.</div>}</div>
    </div>
  </div>;
}
