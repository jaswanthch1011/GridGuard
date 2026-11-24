import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getToken } from '../lib';
export function useGrid() {
  const [state, setState] = useState(null);
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const sock = useRef();
  const refresh = async ()=>{ try{ const [s,e,h]=await Promise.all([api('/state'),api('/events?limit=80'),api('/history?limit=240')]); setState(s); setEvents(e.events||[]); setHistory(h.history||[]);}catch{} };
  useEffect(()=>{
    refresh();
    const s = io('/', { transports:['websocket','polling'], auth:{ token:getToken() } });
    sock.current = s;
    s.on('connect', ()=>setConnected(true));
    s.on('disconnect', ()=>setConnected(false));
    s.on('state', (st)=> setState(st));
    s.on('event', (ev)=> setEvents(p=>[ev,...p].slice(0,120)));
    return ()=> s.close();
  },[]);
  const act = async (path, body, method=body?'POST':'GET') => { const d=await api(path, body?{method,body:JSON.stringify(body)}:{method}); if(d.loads||d.capacityW) setState(d); await refresh(); return d; };
  return { state, events, history, connected, refresh, act };
}
