import { useEffect, useState } from 'react';
import { api } from '../lib';
export default function Devices({ act, canControl }) {
  const [devices,setDevices]=useState([]); const load=()=>api('/devices').then(d=>setDevices(d.devices||[])).catch(()=>{}); useEffect(()=>{ load(); const t=setInterval(load,5000); return ()=>clearInterval(t); },[]);
  return <div><div className="hero"><div><h1>IoT Device Management</h1><p>ESP32 node status, connectivity, telemetry freshness, relay state, and simulator fault injection.</p></div></div>
    <div className="card"><table className="table"><thead><tr><th>Device</th><th>Load</th><th>Status</th><th>MQTT/Wi-Fi</th><th>Last Seen</th><th>Firmware</th><th>Relay</th><th>Actions</th></tr></thead><tbody>
      {devices.map(d=><tr key={d.deviceId}><td><strong>{d.deviceId}</strong></td><td>{d.name}</td><td><span className={`badge ${d.status==='Online'?'ok':'critical'}`}>{d.status}</span></td><td>{d.mqtt} / {d.wifi}</td><td className="muted">{d.lastSeen?new Date(d.lastSeen).toLocaleTimeString():'—'}</td><td>{d.firmware}</td><td>{d.relay}</td><td>{canControl && <div className="row"><button className="btn ghost" onClick={()=>act('/sim/fault',{loadId:d.loadId,type:'surge'})}>Surge</button><button className="btn ghost" onClick={()=>act('/sim/fault',{loadId:d.loadId,type:'silent'})}>Silent</button><button className="btn ghost" onClick={()=>act('/sim/clear',{loadId:d.loadId})}>Clear</button></div>}</td></tr>)}
    </tbody></table></div>
  </div>;
}
