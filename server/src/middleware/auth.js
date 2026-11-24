import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const secret = () => process.env.JWT_SECRET || 'gridguard-mini-dev-secret';
export const signToken = (user) => jwt.sign({ sub: String(user._id || user.id), role: user.role, email: user.email, name: user.name }, secret(), { expiresIn: '7d' });
export const verifyToken = (token) => jwt.verify(token, secret());

export function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
    if (!token) return required ? res.status(401).json({ error: 'Authentication required' }) : next();
    try { req.user = verifyToken(token); next(); } catch { return res.status(401).json({ error: 'Invalid token' }); }
  };
}
export function allow(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient role' });
    next();
  };
}
export function socketAuth(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ','');
    if (!token) return next();
    try { socket.user = verifyToken(token); } catch {}
    next();
  });
}
export async function seedAdmin(store) {
  const n = await store.countUsers();
  if (n > 0) return;
  await store.createUser({ name: 'Administrator', email: 'admin@gridguard.local', password: 'admin123', role: 'administrator' });
  console.log('[seed] admin@gridguard.local / admin123');
}
