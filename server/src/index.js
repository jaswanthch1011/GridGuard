import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectStore } from './store.js';
import { Grid, MODES } from './grid.js';
import { Simulator } from './simulator.js';
import { createMqtt } from './mqtt.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { seedAdmin } from './middleware/auth.js';
import { socketAuth } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5000;
const MQTT_URL = process.env.MQTT_URL || '';
const MQTT_PREFIX = process.env.MQTT_PREFIX || 'gridguard';
const SIMULATE = process.env.SIMULATE ? process.env.SIMULATE === 'true' : !MQTT_URL;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const store = await connectStore(process.env.MONGO_URI);
await seedAdmin(store);

const transport = { mqtt: null, sim: null, send(nodeId, cmd) { this.mqtt?.send(nodeId, cmd); this.sim?.command(nodeId, cmd); } };
const grid = new Grid({ store, transport });
await grid.init();

if (MQTT_URL) transport.mqtt = createMqtt({ url: MQTT_URL, prefix: MQTT_PREFIX, username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD, grid });
if (SIMULATE) { transport.sim = new Simulator(grid); transport.sim.start(); }

const app = express();
app.use(cors({ origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'] } });
socketAuth(io);

app.locals.ctx = { store, grid, transport, MODES, dataSource: () => ({ simulator: Boolean(transport.sim), mqtt: MQTT_URL ? { url: MQTT_URL.replace(/\/\/.*@/, '//'), connected: transport.mqtt?.state.connected ?? false, prefix: MQTT_PREFIX } : null, database: store.mode }) };

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, ...app.locals.ctx.dataSource() }));

grid.on('tick', (snap) => io.emit('state', { ...snap, dataSource: app.locals.ctx.dataSource(), faults: transport.sim?.faults() ?? {} }));
grid.on('event', (ev) => io.emit('event', ev));
io.on('connection', (socket) => socket.emit('state', { ...grid.snapshot(), dataSource: app.locals.ctx.dataSource(), faults: transport.sim?.faults() ?? {} }));
setInterval(() => grid.tick(), 1000);

const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

server.listen(PORT, () => console.log(`[gridguard] http://localhost:${PORT} db=${store.mode} sim=${SIMULATE}`));

