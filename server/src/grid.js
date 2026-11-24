import { EventEmitter } from 'node:events';

const V_MIN = 207, V_MAX = 253, OVERCURRENT_FACTOR = 1.3, VERIFY_TIMEOUT_MS = 4000, RESTORE_DELAY_MS = 6000, RESTORE_HEADROOM = 0.92, NODE_STALE_MS = 6000;

export const MODES = { GRID: { label: 'Utility grid', capacityW: 1500 }, DEGRADED: { label: 'Degraded feed', capacityW: 1000 }, BACKUP: { label: 'Backup generator', capacityW: 650 }, CUSTOM: { label: 'Custom limit', capacityW: 900 } };
export const TIERS = { 1: 'Critical', 2: 'Essential', 3: 'Non-critical' };

const DEFAULT_LOADS = [
  { id: 'icu', nodeId: 'esp32-01', name: 'Hospital', group: 'Healthcare', tier: 1, ratedW: 350 },
  { id: 'servers', nodeId: 'esp32-02', name: 'Data Center', group: 'Computing', tier: 1, ratedW: 250 },
  { id: 'home', nodeId: 'esp32-03', name: 'Home', group: 'Residential', tier: 2, ratedW: 200 },
  { id: 'street', nodeId: 'esp32-04', name: 'Street Light', group: 'Lighting', tier: 3, ratedW: 100 },
  { id: 'hvac', nodeId: 'esp32-05', name: 'HVAC', group: 'Comfort', tier: 3, ratedW: 300 },
  { id: 'ev', nodeId: 'esp32-06', name: 'EV Charging', group: 'Mobility', tier: 3, ratedW: 350 },
];

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const mkLoad = (l) => ({ ...l, status: 'ON', faultType: null, override: 'auto', relay: 'ON', voltage: 0, current: 0, power: 0, demandEst: l.ratedW * 0.8, lastSeen: 0, offline: false, shedAt: 0, pending: null, overTicks: 0, voltTicks: 0, energyWh: 0, shedCount: 0, shedMs: 0, avoidedWh: 0, minPower: 0, maxPower: l.ratedW * 1.3, restoreDelayMs: RESTORE_DELAY_MS, criticalProtected: l.tier === 1, allowAutoShed: true, allowManual: true, category: l.group, lastCommand: null, lastAck: null, disconnectReason: null });

export class Grid extends EventEmitter {
  constructor({ store, transport }) {
    super();
    this.store = store; this.transport = transport; this.mode = 'GRID'; this.customCapacityW = MODES.CUSTOM.capacityW;
    this.overloaded = false; this.criticalOverload = false; this.history = []; this.tickCount = 0; this.lastTick = Date.now(); this.startedAt = Date.now();
    this.loads = DEFAULT_LOADS.map(mkLoad);
  }
  get capacityW() { return this.mode === 'CUSTOM' ? this.customCapacityW : MODES[this.mode].capacityW; }
  get totalW() { return this.loads.reduce((s, l) => s + (l.status === 'ON' || l.relay === 'ON' ? l.power : 0), 0); }
  async init() {
    const cfg = await this.store.loadConfig(); if (!cfg) return;
    if (MODES[cfg.mode]) this.mode = cfg.mode;
    if (Number.isFinite(cfg.customCapacityW)) this.customCapacityW = cfg.customCapacityW;
    if (Array.isArray(cfg.loadsList)) {
      this.loads = cfg.loadsList.map((l) => ({ ...mkLoad({ ...DEFAULT_LOADS[0], ...l }), ...l, lastSeen: 0, offline: false, pending: null, overTicks: 0, voltTicks: 0, voltage: 0, current: 0, power: 0 }));
    }
    for (const l of this.loads) {
      const c = cfg.loads?.[l.id]; if (!c) continue;
      if ([1,2,3].includes(c.tier)) l.tier = c.tier; if (['auto','on','off'].includes(c.override)) l.override = c.override;
      if (l.override === 'off') l.status = 'MANUAL_OFF';
      if (typeof c.criticalProtected === 'boolean') l.criticalProtected = c.criticalProtected;
      if (typeof c.allowAutoShed === 'boolean') l.allowAutoShed = c.allowAutoShed;
      if (typeof c.allowManual === 'boolean') l.allowManual = c.allowManual;
      if (Number.isFinite(c.restoreDelayMs)) l.restoreDelayMs = c.restoreDelayMs;
      if (c.name) l.name = c.name; if (c.group) { l.group = c.group; l.category = c.group; }
    }
  }
  persist() {
    const loads = {}; for (const l of this.loads) loads[l.id] = { tier: l.tier, override: l.override, criticalProtected: l.criticalProtected, allowAutoShed: l.allowAutoShed, allowManual: l.allowManual, restoreDelayMs: l.restoreDelayMs, name: l.name, group: l.group };
    return this.store.saveConfig({ mode: this.mode, customCapacityW: this.customCapacityW, loads, loadsList: this.loads.map((l) => ({ id:l.id,nodeId:l.nodeId,name:l.name,group:l.group,tier:l.tier,ratedW:l.ratedW,category:l.category,minPower:l.minPower,maxPower:l.maxPower,criticalProtected:l.criticalProtected,allowAutoShed:l.allowAutoShed,allowManual:l.allowManual,restoreDelayMs:l.restoreDelayMs })) });
  }
  async log(level, type, message, loadId = null, meta = {}) { const ev = { t: Date.now(), level, type, message, loadId, severity: level === 'critical' ? 'Critical' : level === 'warn' ? 'High' : level === 'info' ? 'Medium' : 'Low', ...meta }; this.emit('event', ev); await this.store.addEvent(ev); return ev; }
  command(load, relay, reason = null) { load.pending = { relay, since: Date.now(), retries: load.pending?.relay === relay ? load.pending.retries : 0 }; load.lastCommand = { relay, t: Date.now(), reason }; this.transport.send(load.nodeId, { relay }); }
  ingest(nodeId, msg) {
    const l = this.loads.find((x) => x.nodeId === nodeId); if (!l) return false;
    const voltage = Number(msg.voltage), current = Number(msg.current); if (!Number.isFinite(voltage) || !Number.isFinite(current) || voltage < 0 || current < 0) return false;
    l.lastSeen = Date.now(); if (l.offline) { l.offline = false; this.log('info','NODE_ONLINE',`${l.name}: node ${l.nodeId} reporting again`,l.id); }
    l.voltage = voltage; l.current = current; l.power = voltage * current;
    l.relay = msg.relay === 'ON' || msg.relay === 'OFF' ? msg.relay : current > 0.08 ? 'ON' : 'OFF';
    l.lastAck = { relay: l.relay, t: Date.now() };
    if (l.relay === 'ON' && l.status === 'ON') l.demandEst = 0.7 * l.demandEst + 0.3 * l.power;
    return true;
  }
  trip(l, faultType, message) { l.status = 'FAULT'; l.faultType = faultType; l.disconnectReason = faultType; if (l.override === 'on') l.override = 'auto'; this.command(l,'OFF', faultType); this.log('critical', faultType, message, l.id); }
  tick() {
    const now = Date.now(); const dt = Math.min((now - this.lastTick) / 1000, 5); this.lastTick = now; this.tickCount += 1; const cap = this.capacityW;
    for (const l of this.loads) {
      if (l.lastSeen && now - l.lastSeen > NODE_STALE_MS && !l.offline) { l.offline = true; l.power = 0; l.current = 0; this.log('warn','NODE_OFFLINE',`${l.name}: no telemetry from ${l.nodeId} for ${NODE_STALE_MS/1000}s`,l.id); }
      l.energyWh += (l.power * dt) / 3600; if (l.status === 'SHED') { l.shedMs += dt * 1000; l.avoidedWh += (l.demandEst * dt) / 3600; }
      if (l.status === 'ON' && !l.offline && l.lastSeen) {
        const vBad = l.voltage < V_MIN || l.voltage > V_MAX; l.voltTicks = vBad ? l.voltTicks + 1 : 0; l.overTicks = l.power > l.ratedW * OVERCURRENT_FACTOR ? l.overTicks + 1 : 0;
        if (l.voltTicks >= 2) { const kind = l.voltage < V_MIN ? 'UNDERVOLTAGE' : 'OVERVOLTAGE'; this.trip(l, kind, `${l.name}: ${kind.toLowerCase()} at ${round(l.voltage)} V`); }
        else if (l.overTicks >= 2) this.trip(l, 'OVERCURRENT', `${l.name}: drawing ${Math.round(l.power)} W against ${l.ratedW} W rating`);
      }
      if (l.pending) {
        const age = now - l.pending.since;
        if (l.pending.relay === 'OFF') {
          if (l.relay === 'OFF' && l.current < 0.08) { this.log('info', l.status === 'FAULT' ? 'TRIP_VERIFIED':'SHED_VERIFIED', `${l.name}: de-energised, current ${round(l.current,2)} A confirms relay open`, l.id); l.pending = null; }
          else if (age > VERIFY_TIMEOUT_MS) { if (l.pending.retries < 1) { l.pending.retries += 1; l.pending.since = now; this.transport.send(l.nodeId,{relay:'OFF'}); this.log('warn','VERIFY_RETRY',`${l.name}: still drawing ${Math.round(l.power)} W after OFF, retrying`,l.id); } else { l.status='FAULT'; l.faultType='RELAY_STUCK'; l.pending=null; this.log('critical','RELAY_STUCK',`${l.name}: relay did not open after retry`,l.id); } }
        } else if (l.pending.relay === 'ON') {
          if (l.relay === 'ON' && l.current > 0.08) { this.log('info','RESTORE_VERIFIED',`${l.name}: back online at ${Math.round(l.power)} W`,l.id); l.pending = null; }
          else if (age > VERIFY_TIMEOUT_MS) { l.status='FAULT'; l.faultType='NO_RESPONSE'; l.pending=null; this.log('warn','RESTORE_FAILED',`${l.name}: no load current after restore`,l.id); }
        }
      }
    }
    let projected = 0; for (const l of this.loads) if (l.status === 'ON' || (l.status==='FAULT' && l.faultType==='RELAY_STUCK')) projected += l.power;
    if (projected > cap) {
      if (!this.overloaded) { this.overloaded = true; this.log('warn','OVERLOAD',`Demand ${Math.round(projected)} W exceeds ${cap} W (${this.sourceLabel()}). Shedding by priority.`); }
      const candidates = this.loads.filter((l) => l.status === 'ON' && l.override !== 'on' && !l.offline && l.allowAutoShed && !l.criticalProtected).sort((a,b)=> b.tier-a.tier || b.power-a.power);
      for (const c of candidates) { if (projected <= cap) break; this.shed(c, projected, cap); projected -= c.power; }
      const critical = this.loads.filter((l) => l.status === 'ON' && l.override !== 'on' && !l.offline && (l.criticalProtected || !l.allowAutoShed)).sort((a,b)=>b.power-a.power);
      for (const c of critical) { if (projected <= cap) break; this.shed(c, projected, cap, 'Critical protection overridden by capacity'); projected -= c.power; }
      if (projected > cap && !this.criticalOverload) { this.criticalOverload = true; this.log('critical','CRITICAL_OVERLOAD',`Only protected loads remain (${Math.round(projected)} W) and exceed ${cap} W.`); }
    } else {
      if (this.criticalOverload) this.criticalOverload = false;
      const shed = this.loads.filter((l) => l.status === 'SHED').sort((a,b)=> a.tier-b.tier || a.demandEst-b.demandEst);
      const next = shed[0];
      if (next && now - next.shedAt >= (next.restoreDelayMs || RESTORE_DELAY_MS) && projected + next.demandEst <= cap * RESTORE_HEADROOM) { next.status='ON'; next.disconnectReason=null; this.command(next,'ON','restore'); this.log('info','LOAD_RESTORED',`Restoring ${next.name} (Tier ${next.tier}): ${Math.round(projected)}+~${Math.round(next.demandEst)} W fits ${cap} W`,next.id); }
      if (this.overloaded && shed.length === 0 && projected <= cap) { this.overloaded = false; this.log('info','OVERLOAD_CLEARED','All loads restored. Supply balanced.'); }
    }
    const snap = this.snapshot(); this.history.push({ t: snap.t, totalW: snap.totalW, capacityW: snap.capacityW }); if (this.history.length > 900) this.history.shift();
    if (this.tickCount % 5 === 0) this.store.addSample({ t: snap.t, totalW: round(snap.totalW), capacityW: snap.capacityW, mode: this.mode });
    this.emit('tick', snap);
  }
  shed(l, projected, cap, reason = 'Automatic load shedding') { l.status='SHED'; l.shedAt=Date.now(); l.shedCount += 1; l.disconnectReason=reason; this.command(l,'OFF',reason); this.log('warn','LOAD_SHED',`Shed ${l.name} (Tier ${l.tier}, ${Math.round(l.power)} W): demand ${Math.round(projected)} W exceeded ${cap} W`,l.id); }
  sourceLabel() { return this.mode === 'CUSTOM' ? `custom ${this.customCapacityW} W` : MODES[this.mode].label.toLowerCase(); }
  setSource(mode, capacityW) { if (!MODES[mode]) throw new Error('Unknown source mode'); if (mode === 'CUSTOM') { const w=Number(capacityW); if (!Number.isFinite(w)||w<100||w>5000) throw new Error('capacityW must be between 100 and 5000'); this.customCapacityW=Math.round(w); } const changed = mode!==this.mode||mode==='CUSTOM'; this.mode=mode; if (changed) this.log('info','SOURCE_CHANGE',`Supply changed to ${this.sourceLabel()}, capacity ${this.capacityW} W`); return this.persist(); }
  setTier(id, tier) { const l=this.find(id); if (![1,2,3].includes(tier)) throw new Error('tier must be 1,2,3'); if (l.tier!==tier){ this.log('info','PRIORITY_CHANGE',`${l.name} priority Tier ${l.tier}→${tier}`,l.id); l.tier=tier; l.criticalProtected=tier===1?l.criticalProtected:l.criticalProtected; } return this.persist(); }
  setOverride(id, override) { const l=this.find(id); if (!['auto','on','off'].includes(override)) throw new Error('invalid override'); if (l.status==='FAULT') throw new Error('Load is in FAULT. Reset it first.'); if (!l.allowManual && override!=='auto') throw new Error('Manual override disabled for this load'); l.override=override; if (override==='off'){ if(l.status!=='MANUAL_OFF'){ l.status='MANUAL_OFF'; l.disconnectReason='Manual off'; this.command(l,'OFF','manual'); this.log('info','MANUAL_OFF',`${l.name} switched off by operator`,l.id);} } else if (override==='on'){ if(l.status!=='ON'){ l.status='ON'; this.command(l,'ON','manual pin'); } this.log('info','MANUAL_PIN',`${l.name} pinned ON`,l.id);} else { if(l.status==='MANUAL_OFF'){ l.status='SHED'; l.shedAt=0; } this.log('info','AUTO_MODE',`${l.name} returned to automatic control`,l.id);} return this.persist(); }
  updateLoad(id, patch) { const l=this.find(id); for (const k of ['name','group','category','nodeId']) if (typeof patch[k]==='string' && patch[k].trim()) l[k]=patch[k].trim(); for (const k of ['ratedW','minPower','maxPower','restoreDelayMs']) if (Number.isFinite(Number(patch[k]))) l[k]=Number(patch[k]); for (const k of ['criticalProtected','allowAutoShed','allowManual']) if (typeof patch[k]==='boolean') l[k]=patch[k]; if ([1,2,3].includes(Number(patch.tier))) l.tier=Number(patch.tier); this.log('info','LOAD_UPDATED',`${l.name} configuration updated`,l.id); return this.persist(); }
  addLoad(body) { const id = (body.id || body.name || 'load').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Math.random().toString(36).slice(2,6); const l=mkLoad({ id, nodeId: body.nodeId||`esp32-${String(this.loads.length+1).padStart(2,'0')}`, name: body.name||'New Load', group: body.group||body.category||'General', tier: [1,2,3].includes(Number(body.tier))?Number(body.tier):3, ratedW: Number(body.ratedW)||100 }); l.category=l.group; this.loads.push(l); this.log('info','LOAD_ADDED',`${l.name} added`,l.id); this.persist(); return l; }
  removeLoad(id) { const i=this.loads.findIndex((x)=>x.id===id); if(i<0) throw Object.assign(new Error('Load not found'),{status:404}); const [l]=this.loads.splice(i,1); this.log('warn','LOAD_REMOVED',`${l.name} removed`,id); return this.persist(); }
  reset(id) { const l=this.find(id); if (l.status!=='FAULT') throw new Error('Load is not in FAULT'); const was=l.faultType; l.status='SHED'; l.faultType=null; l.disconnectReason=null; l.shedAt=0; l.overTicks=0; l.voltTicks=0; l.pending=null; this.log('info','FAULT_RESET',`${l.name}: ${was} cleared by operator`,l.id); }
  find(id){ const l=this.loads.find((x)=>x.id===id); if(!l){ const e=new Error('Load not found'); e.status=404; throw e; } return l; }
  snapshot() {
    const totalW=this.totalW;
    return { t:Date.now(), mode:this.mode, sourceLabel:MODES[this.mode].label, capacityW:this.capacityW, customCapacityW:this.customCapacityW, totalW:round(totalW), headroomW:round(this.capacityW-totalW), overloaded:this.overloaded, criticalOverload:this.criticalOverload,
      loads:this.loads.map((l)=>({ id:l.id,nodeId:l.nodeId,name:l.name,group:l.group,category:l.category||l.group,tier:l.tier,ratedW:l.ratedW,minPower:l.minPower,maxPower:l.maxPower,status:l.status,faultType:l.faultType,override:l.override,relay:l.relay,voltage:round(l.voltage),current:round(l.current,2),power:round(l.power),offline:l.offline,pending:l.pending?l.pending.relay:null,lastCommand:l.lastCommand,lastAck:l.lastAck,disconnectReason:l.disconnectReason,criticalProtected:l.criticalProtected,allowAutoShed:l.allowAutoShed,allowManual:l.allowManual,restoreDelayMs:l.restoreDelayMs,shedCount:l.shedCount,energyWh:round(l.energyWh,2) })) };
  }
  analytics() { const loads=this.loads.map((l)=>({id:l.id,name:l.name,tier:l.tier,energyWh:round(l.energyWh,2),shedCount:l.shedCount,shedSeconds:Math.round(l.shedMs/1000),avoidedWh:round(l.avoidedWh,2)})); return { since:this.startedAt,totalEnergyWh:round(loads.reduce((s,l)=>s+l.energyWh,0),2),totalAvoidedWh:round(loads.reduce((s,l)=>s+l.avoidedWh,0),2),totalShedEvents:loads.reduce((s,l)=>s+l.shedCount,0),loads }; }
}
