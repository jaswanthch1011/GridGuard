import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!getToken()) return setReady(true); api('/auth/me').then(d=>setUser(d.user)).catch(()=>setToken(null)).finally(()=>setReady(true)); }, []);
  const login = async (email,password)=>{ const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})}); setToken(d.token); setUser(d.user); return d.user; };
  const logout = ()=>{ setToken(null); setUser(null); };
  const refresh = async ()=>{ const d=await api('/auth/me'); setUser(d.user); return d.user; };
  return <Ctx.Provider value={{ user, ready, login, logout, refresh, role:user?.role }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
