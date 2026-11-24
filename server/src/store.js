import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const schemas = {
  Event: new mongoose.Schema({ t:Number, level:String, type:String, loadId:String, message:String, severity:String, meta:Object }, { timestamps:false }),
  Sample: new mongoose.Schema({ t:{type:Number,index:true}, totalW:Number, capacityW:Number, mode:String }),
  Config: new mongoose.Schema({ key:{type:String,unique:true}, value:Object }),
  User: new mongoose.Schema({ name:String, email:{type:String,unique:true,lowercase:true}, password:String, role:{type:String,default:'viewer'}, preferences:{type:Object,default:{}}, notifications:{type:Object,default:{alerts:true,email:false}} }, { timestamps:true }),
};

export async function connectStore(uri) {
  const mem = { events: [], samples: [], config: null, users: [] };
  let mongo = false;
  if (uri) { try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 }); mongo = true; console.log('[store] MongoDB connected'); } catch (err) { console.warn('[store] memory fallback:', err.message); } }
  else console.log('[store] MONGO_URI unset, memory mode');
  const M = (n) => mongoose.models[n] || mongoose.model(n, schemas[n]);
  const store = {
    mode: mongo ? 'mongodb' : 'memory',
    async addEvent(ev){ if(mongo) return M('Event').create(ev).catch(()=>{}); mem.events.push(ev); if(mem.events.length>2000) mem.events.shift(); },
    async listEvents({ level, limit=200 }={}){ if(mongo){ const q=level?{level}:{}; return (await M('Event').find(q).sort({t:-1}).limit(limit).lean()).map(({_id,__v,...r})=>r);} const rows=level?mem.events.filter(e=>e.level===level):mem.events; return rows.slice(-limit).reverse(); },
    async addSample(s){ if(mongo) return M('Sample').create(s).catch(()=>{}); mem.samples.push(s); if(mem.samples.length>5000) mem.samples.shift(); },
    async listSamples(limit=400){ if(mongo){ return (await M('Sample').find().sort({t:-1}).limit(limit).lean()).map(({_id,__v,...r})=>r).reverse(); } return mem.samples.slice(-limit); },
    async loadConfig(){ if(mongo){ const d=await M('Config').findOne({key:'grid'}).lean(); return d?.value||null; } return mem.config; },
    async saveConfig(value){ if(mongo) return M('Config').updateOne({key:'grid'},{value},{upsert:true}).catch(()=>{}); mem.config=value; },
    async findUser(email){ if(mongo) return M('User').findOne({email:String(email).toLowerCase()}).lean(); return mem.users.find(u=>u.email===String(email).toLowerCase())||null; },
    async findUserById(id){ if(mongo){ if(!mongoose.isValidObjectId(id)) return null; return M('User').findById(id).lean(); } return mem.users.find(u=>u.id===id)||null; },
    async createUser(data){ const doc={...data,email:String(data.email).toLowerCase(),password:await bcrypt.hash(data.password,10)}; if(mongo) return M('User').create(doc).then(d=>d.toObject()); const u={id:String(mem.users.length+1),...doc,createdAt:new Date()}; mem.users.push(u); return u; },
    async listUsers(){ if(mongo) return M('User').find().select('-password').sort({createdAt:-1}).lean(); return mem.users.map(({password,...u})=>u); },
    async updateUser(id,data){ if(data.password) data.password=await bcrypt.hash(data.password,10); if(mongo) return M('User').findByIdAndUpdate(id,data,{new:true}).select('-password').lean(); const u=mem.users.find(x=>x.id===id); if(!u) return null; Object.assign(u,data); const {password,...r}=u; return r; },
    async deleteUser(id){ if(mongo) return M('User').findByIdAndDelete(id); mem.users=mem.users.filter(u=>u.id!==id); },
    async countUsers(){ if(mongo) return M('User').countDocuments(); return mem.users.length; },
  };
  return store;
}
