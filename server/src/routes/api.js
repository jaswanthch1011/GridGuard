import express from 'express';
import { auth, allow } from '../middleware/auth.js';
const router = express.Router();
const wrap = (fn) => async (req,res)=>{ try { res.json(await fn(req,res)); } catch(e){ res.status(e.status||400).json({error:e.message}); } };
const ctx = (req) => req.app.locals.ctx;
const modes = { GRID:{label:'Utility grid',capacityW:1500}, DEGRADED:{label:'Degraded feed',capacityW:1000}, BACKUP:{label:'Backup generator',capacityW:650}, CUSTOM:{label:'Custom limit',capacityW:900} };

router.get('/state', auth(), (req,res)=>{ const {grid,dataSource,transport}=ctx(req); res.json({ ...grid.snapshot(), dataSource:dataSource(), modes, faults:transport.sim?.faults()??{} }); });
router.get('/modes', auth(), (_req,res)=> res.json({ modes }));
router.get('/history', auth(), wrap(async (req)=>{ const {grid,store}=ctx(req); return { history:grid.history.slice(-Number(req.query.limit||400)), samples: await store.listSamples(Number(req.query.limit||400)) }; }));
router.get('/analytics', auth(), (req,res)=> res.json(ctx(req).grid.analytics()));
router.get('/events', auth(), wrap(async (req)=>{ const level=['info','warn','critical'].includes(req.query.level)?req.query.level:undefined; return { events: await ctx(req).store.listEvents({ level, limit: Math.min(Number(req.query.limit)||200,1000) }) }; }));
router.get('/alerts', auth(), wrap(async (req)=>{ const events=await ctx(req).store.listEvents({ limit:200 }); return { alerts: events.filter(e=>['warn','critical'].includes(e.level)).map((e,i)=>({ id:`A-${e.t}-${i}`, type:e.type, severity:e.severity|| (e.level==='critical'?'Critical':'High'), timestamp:e.t, affectedLoad:e.loadId, description:e.message, status:'Open', recommendedAction: rec(e.type) })) }; }));

router.post('/source', auth(), allow('administrator','operator'), wrap(async (req)=>{ await ctx(req).grid.setSource(req.body.mode, req.body.capacityW); return ctx(req).grid.snapshot(); }));
router.post('/loads', auth(), allow('administrator','operator'), wrap(async (req)=>{ const l=ctx(req).grid.addLoad(req.body||{}); ctx(req).transport.sim?.sync?.(); return { load:l, state:ctx(req).grid.snapshot() }; }));
router.patch('/loads/:id', auth(), allow('administrator','operator'), wrap(async (req)=>{ const g=ctx(req).grid; if(req.body.tier!==undefined) await g.setTier(req.params.id, Number(req.body.tier)); if(req.body.override!==undefined) await g.setOverride(req.params.id, req.body.override); if(Object.keys(req.body||{}).some(k=>!['tier','override'].includes(k))) await g.updateLoad(req.params.id, req.body); return g.snapshot(); }));
router.delete('/loads/:id', auth(), allow('administrator'), wrap(async (req)=>{ await ctx(req).grid.removeLoad(req.params.id); return ctx(req).grid.snapshot(); }));
router.post('/loads/:id/reset', auth(), allow('administrator','operator'), wrap(async (req)=>{ ctx(req).grid.reset(req.params.id); return ctx(req).grid.snapshot(); }));
router.post('/priorities', auth(), allow('administrator','operator'), wrap(async (req)=>{ const g=ctx(req).grid; for (const item of req.body.order||[]) { const l=g.loads.find(x=>x.id===item.id); if(l && [1,2,3].includes(Number(item.tier))) l.tier=Number(item.tier); } await g.log('info','PRIORITY_POLICY',`Priority policy updated for ${req.body.order?.length||0} loads`); await g.persist(); return g.snapshot(); }));

router.post('/simulate', auth(), allow('administrator','operator'), wrap(async (req)=>{ const g=ctx(req).grid; const { capacityW, scenario } = req.body||{}; const before=g.snapshot(); const cap=Number(capacityW); if(Number.isFinite(cap)) await g.setSource('CUSTOM', cap); if(scenario) await g.log('info','SIMULATION',`Simulation: ${scenario} at ${g.capacityW} W`);
  const total=before.loads.reduce((s,l)=>s+(l.status==='ON'?l.power:l.demandEst||l.ratedW*0.8),0); const deficit=Math.max(0,total-g.capacityW); let rem=deficit; const shed=[]; for (const l of [...before.loads].sort((a,b)=>b.tier-a.tier||b.power-a.power)){ if(rem<=0) break; shed.push({id:l.id,name:l.name,tier:l.tier,power:Math.round(l.power||l.ratedW*0.8)}); rem-= (l.power||l.ratedW*0.8);} return { before, capacityW:g.capacityW, totalDemand:Math.round(total), deficit:Math.round(deficit), sheddingSequence:shed, explanation:`Disconnect lowest-priority eligible loads until demand fits ${g.capacityW} W.` }; }));

const needSim=(req,res,next)=> (ctx(req).transport.sim?next():res.status(409).json({error:'Simulator required'}));
router.post('/sim/fault', auth(), allow('administrator','operator'), needSim, wrap(async (req)=>{ const {grid,transport}=ctx(req); const l=grid.find(req.body.loadId); transport.sim.inject(l.nodeId, req.body.type); await grid.log('warn','FAULT_INJECTED',`Injected ${req.body.type} on ${l.name}`,l.id); return { faults:transport.sim.faults() }; }));
router.post('/sim/clear', auth(), allow('administrator','operator'), needSim, wrap(async (req)=>{ const {grid,transport}=ctx(req); const nodeId=req.body.loadId?grid.find(req.body.loadId).nodeId:undefined; transport.sim.clear(nodeId); await grid.log('info','FAULT_CLEARED', nodeId?`Cleared fault on ${nodeId}`:'Cleared all injected faults'); return { faults:transport.sim.faults() }; }));

router.get('/devices', auth(), (req,res)=>{ const {grid,transport,dataSource}=ctx(req); const faults=transport.sim?.faults()||{}; res.json({ devices:grid.loads.map(l=>({ deviceId:l.nodeId,name:l.name,status:l.offline?'Offline':'Online',wifi:'Connected',mqtt:dataSource().mqtt?.connected?'Connected':'N/A',lastSeen:l.lastSeen,firmware:'1.0.0',sensorStatus:l.offline?'Stale':'OK',relayStatus:l.relay,injectedFault:faults[l.nodeId]||null,loadId:l.id })) }); });
router.get('/users', auth(), allow('administrator'), wrap(async (req)=> ({ users: await ctx(req).store.listUsers() })));
router.post('/users', auth(), allow('administrator'), wrap(async (req)=>{ const u=await ctx(req).store.createUser(req.body||{}); const {password,...r}=u; r.id=String(r._id||r.id); return { user:r }; }));
router.delete('/users/:id', auth(), allow('administrator'), wrap(async (req)=>{ await ctx(req).store.deleteUser(req.params.id); return { ok:true }; }));
router.get('/settings', auth(), wrap(async (req)=> ({ settings:(await ctx(req).store.loadConfig())?.settings || { maxSource:1500, overloadThreshold:100, minReserve:0, shortageThreshold:95, restoreThreshold:92, restoreDelay:6 } })));
router.patch('/settings', auth(), allow('administrator','operator'), wrap(async (req)=>{ const c=(await ctx(req).store.loadConfig())||{}; c.settings={...(c.settings||{}), ...(req.body||{})}; await ctx(req).store.saveConfig(c); await ctx(req).grid.log('info','SETTINGS_UPDATED','System settings updated'); return { settings:c.settings }; }));

function rec(type){ return { OVERLOAD:'Reduce demand or increase source capacity.', CRITICAL_OVERLOAD:'Disconnect pinned/nonessential loads or add capacity.', NODE_OFFLINE:'Check ESP32 power, Wi-Fi, and MQTT broker.', RELAY_STUCK:'Inspect relay/MOSFET wiring and isolate load.', OVERCURRENT:'Inspect load wiring and rating.', OVERVOLTAGE:'Check source regulation.', UNDERVOLTAGE:'Check source capacity and wiring.' }[type] || 'Review event details.'; }
export default router;
