import mqtt from 'mqtt';

export function createMqtt({ url, prefix, username, password, grid }) {
  const state = { connected: false };
  const client = mqtt.connect(url, { username, password, reconnectPeriod: 3000 });
  client.on('connect', () => { state.connected = true; client.subscribe(`${prefix}/+/telemetry`); console.log('[mqtt] connected'); });
  client.on('close', () => { state.connected = false; });
  client.on('error', (err) => console.warn('[mqtt]', err.message));
  client.on('message', (topic, payload) => {
    const m = topic.match(new RegExp(`^${prefix}/([^/]+)/telemetry$`)); if (!m) return;
    try { grid.ingest(m[1], JSON.parse(payload.toString())); } catch {}
  });
  return {
    state,
    send(nodeId, cmd) { if (state.connected) client.publish(`${prefix}/${nodeId}/cmd`, JSON.stringify(cmd), { qos: 1 }); },
  };
}
