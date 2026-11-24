const API = '/api';
export function getToken() { return localStorage.getItem('gg_token'); }
export function setToken(t) { if (t) localStorage.setItem('gg_token', t); else localStorage.removeItem('gg_token'); }
export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
export const fmtW = (w) => w >= 1000 ? `${(w/1000).toFixed(2)} kW` : `${Math.round(w)} W`;
export const tierLabel = (t) => ({1:'Critical',2:'Normal',3:'Low'})[t] || 'Normal';
export const ago = (t) => { if(!t) return '—'; const s=Math.floor((Date.now()-t)/1000); if(s<60) return `${s}s ago`; if(s<3600) return `${Math.floor(s/60)}m ago`; return `${Math.floor(s/3600)}h ago`; };
