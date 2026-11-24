import { BigChart } from '../components/Charts.jsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
export default function Analytics({ state, history, analytics }) {
  const loads=state?.loads||[]; const a=analytics||{loads:[],totalEnergyWh:0,totalAvoidedWh:0,totalShedEvents:0};
  const pie = a.loads.map(l=>({name:l.name,value:Math.round(l.energyWh||0)})).filter(x=>x.value>0);
  const colors=['#47b892','#0f5b66','#79d7b5','#f0a84b','#e86b5a','#7aaeb8'];
  const chart=history.map(h=>({t:h.t,demand:Math.round(h.totalW),capacity:h.capacityW}));
  return <div><div className="hero"><div><h1>Energy Analytics</h1><p>Historical consumption, peak demand, shedding frequency, and avoided energy.</p></div></div>
    <div className="grid g4" style={{marginBottom:16}}>
      {[['Total Energy',`${Math.round(a.totalEnergyWh)} Wh`],['Energy Saved',`${Math.round(a.totalAvoidedWh)} Wh`],['Shed Events',a.totalShedEvents],['Peak Demand',`${Math.max(0,...history.map(h=>Math.round(h.totalW||0)))} W`]].map(([l,v])=><div className="card" key={l}><div className="muted">{l}</div><div style={{fontSize:'1.8rem',fontWeight:800,marginTop:6}}>{v}</div></div>)}
    </div>
    <div className="grid g2" style={{marginBottom:16}}>
      <div className="card"><h3>Demand vs Capacity</h3><BigChart data={chart} lines={[{key:'demand',name:'Demand',color:'#47b892'},{key:'capacity',name:'Capacity',color:'#0f5b66'}]} /></div>
      <div className="card"><h3>Energy by Load</h3><div style={{height:220}}><ResponsiveContainer><PieChart><Pie data={pie.length?pie:[{name:'No data',value:1}]} dataKey="value" nameKey="name" outerRadius={80} label>{(pie.length?pie:[{name:'No data',value:1}]).map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div></div>
    </div>
    <div className="card"><h3>Load-Shedding Frequency & Energy</h3><div style={{height:260}}><ResponsiveContainer><BarChart data={a.loads}><CartesianGrid strokeDasharray="3 3" stroke="#d9e8e3"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Bar dataKey="shedCount" name="Shed events" fill="#f0a84b"/><Bar dataKey="energyWh" name="Energy (Wh)" fill="#47b892"/></BarChart></ResponsiveContainer></div></div>
  </div>;
}
