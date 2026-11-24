import express from 'express';
import bcrypt from 'bcryptjs';
import { auth, allow } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
const router = express.Router();
const secret = () => process.env.JWT_SECRET || 'gridguard-mini-dev-secret';
const sign = (u) => jwt.sign({ sub:String(u._id||u.id), role:u.role, email:u.email, name:u.name }, secret(), { expiresIn:'7d' });

router.post('/login', async (req,res)=>{
  const { store } = req.app.locals.ctx;
  const { email, password } = req.body || {};
  const u = await store.findUser(email);
  if (!u || !(await bcrypt.compare(String(password||''), u.password))) return res.status(401).json({ error:'Invalid credentials' });
  const user = { id:String(u._id||u.id), name:u.name, email:u.email, role:u.role, preferences:u.preferences||{}, notifications:u.notifications||{} };
  res.json({ token: sign(user), user });
});
router.post('/register', auth(), allow('administrator'), async (req,res)=>{
  const { store } = req.app.locals.ctx; const { name,email,password,role='viewer' } = req.body||{};
  if (!email||!password) return res.status(400).json({error:'email and password required'});
  if (await store.findUser(email)) return res.status(409).json({error:'User exists'});
  const u = await store.createUser({ name:name||email, email, password, role });
  res.json({ user:{ id:String(u._id||u.id), name:u.name, email:u.email, role:u.role } });
});
router.get('/me', auth(), async (req,res)=>{
  const { store } = req.app.locals.ctx; const u = await store.findUserById(req.user.sub);
  if (!u) return res.status(404).json({error:'Not found'}); const {password,...user}=u; user.id=String(user._id||user.id); res.json({ user });
});
router.patch('/me', auth(), async (req,res)=>{
  const { store } = req.app.locals.ctx; const patch={}; for (const k of ['name','preferences','notifications','password']) if (req.body?.[k]!==undefined) patch[k]=req.body[k];
  const u = await store.updateUser(req.user.sub, patch); if(!u) return res.status(404).json({error:'Not found'});
  u.id=String(u._id||u.id); res.json({ user:u, token: sign(u) });
});
export default router;
