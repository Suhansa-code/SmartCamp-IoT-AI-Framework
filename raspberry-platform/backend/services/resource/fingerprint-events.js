/**
 * Server-Sent Events hub for live fingerprint hardware events.
 *
 * The scanner pushes asynchronously (a finger touches the pad with no HTTP
 * request in flight), so the registration UI needs a server → browser channel.
 * SSE carries that with no extra dependency and rides the existing Express app.
 */
import logger from '../../utils/logger.js';

const clients = new Set();
const HEARTBEAT_MS = 25000;
let socketServer = null;

let heartbeat = null;

export function setSocketServer(io) {
  socketServer = io;
}

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const res of clients) {
      try { res.write(': ping\n\n'); } catch (_) { clients.delete(res); }
    }
  }, HEARTBEAT_MS);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();
}

export function subscribe(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  clients.add(res);
  startHeartbeat();
  logger.debug(`[FP] SSE client attached (${clients.size} total)`);

  req.on('close', () => {
    clients.delete(res);
    logger.debug(`[FP] SSE client detached (${clients.size} remaining)`);
  });
}

export function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  socketServer?.emit(event, data);
  for (const res of clients) {
    try { res.write(frame); } catch (_) { clients.delete(res); }
  }
}

export function subscriberCount() {
  return clients.size;
}
