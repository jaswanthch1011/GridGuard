import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Search, Settings, UserCircle2, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ events=[] }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const alerts = events.filter(e=>e.level==='critical'||e.level==='warn').length;
  return (
    <div className="app-shell">
      <header className="topnav">
        <NavLink to="/" className="brand"><span className="brand-mark"><Zap size={18} /></span> GridGuard <span style={{color:'#79d7b5',marginLeft:4}}>Mini</span></NavLink>
        <nav className="navlinks">
          <NavLink to="/">Dashboard</NavLink><NavLink to="/live">Live Monitoring</NavLink><NavLink to="/analytics">Analytics</NavLink><NavLink to="/events">Logs</NavLink>
          <NavLink to="/loads">Loads</NavLink><NavLink to="/priorities">Priorities</NavLink><NavLink to="/simulator">Simulator</NavLink><NavLink to="/devices">Devices</NavLink>
        </nav>
        <div className="top-actions">
          <div className="row search"><Search size={16}/><input placeholder="Search loads, events, devices..." style={{background:'transparent',border:'none',color:'#fff',outline:'none',width:'100%'}} onKeyDown={e=>e.key==='Enter'&&nav('/events?q='+encodeURIComponent(e.target.value))}/></div>
          <NavLink to="/alerts" className="iconbtn" title="Alerts"><Bell size={17}/>{alerts>0&&<span className="dot"/>}</NavLink>
          <NavLink to="/settings" className="iconbtn" title="Settings"><Settings size={17}/></NavLink>
          <NavLink to="/profile" className="iconbtn" title={user?.name}><UserCircle2 size={17}/></NavLink>
          <button className="pill" onClick={()=>{logout(); nav('/login');}}>Logout</button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </div>
  );
}
