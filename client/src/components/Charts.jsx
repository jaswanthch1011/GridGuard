import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
export default function Spark({ data=[], dataKey='value', color='#47b892', height=54 }) {
  return <div className="spark"><ResponsiveContainer width="100%" height={height}><AreaChart data={data} margin={{left:0,right:0,top:6,bottom:0}}><defs><linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.35}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#g-${dataKey})`} dot={false}/></AreaChart></ResponsiveContainer></div>;
}
export function BigChart({ data, lines }) {
  return <div style={{width:'100%',height:220}}><ResponsiveContainer><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#d9e8e3"/><XAxis dataKey="t" tick={{fontSize:11}} tickFormatter={t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}/><YAxis tick={{fontSize:11}} width={42}/><Tooltip labelFormatter={t=>new Date(t).toLocaleTimeString()}/>{lines.map(l=><Area key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} fill={l.color} fillOpacity={.12} strokeWidth={2} dot={false}/>)}</AreaChart></ResponsiveContainer></div>;
}
