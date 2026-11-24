export class Simulator {
  constructor(grid) {
    this.grid = grid;
    this.nodes = new Map(grid.loads.map((l, i) => [l.nodeId, { relay: 'ON', fault: null, idx: i, rated: l.ratedW }]));
    this.timer = null;
  }
  start() { this.timer = setInterval(() => this.publish(), 1000); }
  stop() { clearInterval(this.timer); }
  sync() { for (const l of this.grid.loads) if (!this.nodes.has(l.nodeId)) this.nodes.set(l.nodeId,{relay:'ON',fault:null,idx:this.nodes.size,rated:l.ratedW}); }
  command(nodeId, cmd) { const n=this.nodes.get(nodeId); if(!n||n.fault==='stuck') return; if(cmd.relay==='ON'||cmd.relay==='OFF') n.relay=cmd.relay; }
  inject(nodeId,fault){ const n=this.nodes.get(nodeId); if(!n) throw new Error('Unknown node'); if(!['surge','undervolt','stuck','silent'].includes(fault)) throw new Error('fault must be surge,undervolt,stuck,silent'); n.fault=fault; }
  clear(nodeId){ if(nodeId){ const n=this.nodes.get(nodeId); if(n) n.fault=null; } else for (const n of this.nodes.values()) n.fault=null; }
  faults(){ return Object.fromEntries([...this.nodes].filter(([,n])=>n.fault).map(([id,n])=>[id,n.fault])); }
  publish() {
    this.sync(); const t=Date.now()/1000;
    for (const [nodeId,n] of this.nodes) {
      if (n.fault==='silent') continue;
      let voltage = 230 + Math.sin(t/8 + n.idx)*1.2 + (Math.random()-0.5)*1.8;
      if (n.fault==='undervolt') voltage = 178 + Math.random()*3;
      let demand = n.rated * (0.78 + 0.1*Math.sin(t/9+n.idx) + (Math.random()-0.5)*0.05);
      if (n.fault==='surge') demand = n.rated * 1.7;
      const on = n.relay==='ON';
      const current = on ? demand/Math.max(voltage,1) : Math.random()*0.01;
      this.grid.ingest(nodeId,{ voltage, current, relay:n.relay });
    }
  }
}
