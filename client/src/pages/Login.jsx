import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [email,setEmail]=useState('admin@gridguard.local'); const [password,setPassword]=useState('admin123'); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const submit = async (e)=>{ e.preventDefault(); setBusy(true); setErr(''); try{ await login(email,password); nav('/'); }catch(e){ setErr(e.message); } finally{ setBusy(false);} };
  return <div className="login-wrap"><form className="login" onSubmit={submit}>
    <div className="row" style={{marginBottom:14}}><span className="brand-mark">⚡</span><div><h1>GridGuard Mini</h1><div className="muted">Smart power management login</div></div></div>
    {err && <div className="badge fault" style={{display:'block',marginBottom:10}}>{err}</div>}
    <label className="field"><span>Email</span><input value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
    <button className="btn" style={{width:'100%',marginTop:8}} disabled={busy}>{busy?'Signing in...':'Sign in'}</button>
    <div className="muted" style={{marginTop:12,fontSize:'.88rem'}}>Default admin: admin@gridguard.local / admin123. Roles: administrator, operator, viewer.</div>
  </form></div>;
}
