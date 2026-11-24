import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function useGrid() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const socketRef = useRef(null);

  const refreshEvents = useCallback(() => api('/api/events?limit=200').then((d) => setEvents(d.events)).catch(() => {}), []);
  const refreshAnalytics = useCallback(() => api('/api/analytics').then(setAnalytics).catch(() => {}), []);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      api('/api/history').then((d) => setHistory(d.history)).catch(() => {});
      refreshEvents();
      refreshAnalytics();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('state', (s) => {
      setState(s);
      setHistory((h) => [...h.slice(-179), { t: s.t, totalW: s.totalW, capacityW: s.capacityW }]);
    });
    socket.on('event', (ev) => setEvents((e) => [ev, ...e].slice(0, 200)));
    const poll = setInterval(refreshAnalytics, 5000);
    return () => {
      clearInterval(poll);
      socket.close();
    };
  }, [refreshEvents, refreshAnalytics]);

  const actions = {
    setSource: (mode, capacityW) => api('/api/source', { method: 'POST', body: { mode, capacityW } }),
    patchLoad: (id, body) => api(`/api/loads/${id}`, { method: 'PATCH', body }),
    resetLoad: (id) => api(`/api/loads/${id}/reset`, { method: 'POST' }),
    inject: (loadId, type) => api('/api/sim/fault', { method: 'POST', body: { loadId, type } }),
    clearFaults: (loadId) => api('/api/sim/clear', { method: 'POST', body: { loadId } }),
  };

  return { state, connected, history, events, analytics, actions };
}
