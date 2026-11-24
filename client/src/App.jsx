import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useGrid } from './hooks/useGrid.js';
import Guard from './components/Guard.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveMonitoring from './pages/LiveMonitoring.jsx';
import Analytics from './pages/Analytics.jsx';
import Events from './pages/Events.jsx';
import Loads from './pages/Loads.jsx';
import Priorities from './pages/Priorities.jsx';
import Simulator from './pages/Simulator.jsx';
import Alerts from './pages/Alerts.jsx';
import Devices from './pages/Devices.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import { useEffect, useState } from 'react';
import { api } from './lib.js';

function Shell() {
  const { user } = useAuth();
  const grid = useGrid();
  const [range,setRange]=useState('Real-Time');
  const [analytics,setAnalytics]=useState(null);
  useEffect(()=>{ api('/analytics').then(setAnalytics).catch(()=>{}); const t=setInterval(()=>api('/analytics').then(setAnalytics).catch(()=>{}),5000); return ()=>clearInterval(t); },[grid.state?.t]);
  const canControl = ['administrator','operator'].includes(user?.role);
  const canAdmin = user?.role==='administrator';
  return <Routes>
    <Route path="/login" element={<Login/>} />
    <Route element={<Guard><Layout events={grid.events}/></Guard>}>
      <Route index element={<Dashboard grid={{...grid,analytics,userName:user?.name}} history={grid.history} events={grid.events} act={grid.act} canControl={canControl} range={range} setRange={setRange} />} />
      <Route path="live" element={<LiveMonitoring state={grid.state} history={grid.history} act={grid.act} canControl={canControl}/>} />
      <Route path="analytics" element={<Analytics state={grid.state} history={grid.history} analytics={analytics}/>} />
      <Route path="events" element={<Events events={grid.events}/>} />
      <Route path="loads" element={<Loads state={grid.state} act={grid.act} canControl={canControl}/>} />
      <Route path="priorities" element={<Priorities state={grid.state} act={grid.act} canControl={canControl}/>} />
      <Route path="simulator" element={<Guard roles={['administrator','operator']}><Simulator state={grid.state} act={grid.act}/></Guard>} />
      <Route path="alerts" element={<Alerts/>} />
      <Route path="devices" element={<Devices act={grid.act} canControl={canControl}/>} />
      <Route path="settings" element={<Settings canAdmin={canAdmin}/>} />
      <Route path="profile" element={<Profile/>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
export default function App(){ return <AuthProvider><Shell/></AuthProvider>; }
