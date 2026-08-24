import { EventEmitter } from 'node:events';
import logger from '../../utils/logger.js';

const RECONNECT_MS = 5000;

export class FingerprintSerial extends EventEmitter {
  constructor({ path, baudRate = 115200 } = {}) {
    super();
    this.path = path;
    this.baudRate = baudRate;
    this.port = null;
    this.running = false;
    this.connected = false;
    this.reconnectTimer = null;
  }

  get status() {
    return { connected: this.connected, port: this.path, baudRate: this.baudRate };
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.open();
  }

  async open() {
    if (!this.running || this.connected) return;

    let SerialPort, ReadlineParser;
    try {
      ({ SerialPort } = await import('serialport'));
      ({ ReadlineParser } = await import('@serialport/parser-readline'));
    } catch (err) {
      logger.warn(`[FP] serialport driver unavailable: ${err.message}`);
      this.emitStatus(err);
      this.stopRetrying();
      return;
    }

    const port = new SerialPort({
      path: this.path,
      baudRate: this.baudRate,
      autoOpen: false,
    });

    const opened = await new Promise((resolve) => {
      port.open((err) => resolve(!err));
      port.once('error', () => {});
    });

    if (!opened) {
      logger.warn(`[FP] Cannot open ${this.path} — retrying every ${RECONNECT_MS / 1000}s`);
      this.emitStatus(new Error(`cannot open ${this.path}`));
      this.scheduleReconnect();
      return;
    }

    this.port = port;
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', (line) => this.handleLine(line));
    port.on('close', () => this.onClose());
    port.on('error', (err) => logger.warn(`[FP] Serial error: ${err.message}`));

    this.connected = true;
    logger.info(`[FP] Sensor connected on ${this.path} @ ${this.baudRate} baud`);
    this.emitStatus();
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open().catch((err) =>
        logger.error(`[FP] Reconnect failed: ${err.message}`)
      );
    }, RECONNECT_MS);
    if (typeof this.reconnectTimer.unref === 'function') this.reconnectTimer.unref();
  }

  stopRetrying() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  onClose() {
    if (!this.connected && !this.running) return;
    this.connected = false;
    this.port = null;
    logger.warn('[FP] Sensor disconnected');
    this.emitStatus();
    this.scheduleReconnect();
  }

  handleLine(line) {
    const clean = line.trim();
    if (!clean.startsWith('{')) {
      logger.debug(`[FP] Device line (not JSON): ${clean}`);
      return;
    }
    let packet;
    try {
      packet = JSON.parse(clean);
    } catch (err) {
      logger.warn(`[FP] Bad JSON from device: ${clean}`);
      return;
    }
    logger.debug(`[FP] Packet: ${clean}`);
    this.emit('device-event', packet);
  }

  send(command) {
    if (!this.connected || !this.port) {
      logger.warn(`[FP] Cannot send ${JSON.stringify(command)} — sensor not connected`);
      return false;
    }
    this.port.write(JSON.stringify(command) + '\n', (err) => {
      if (err) logger.error(`[FP] Serial write failed: ${err.message}`);
    });
    return true;
  }

  emitStatus(error) {
    const snapshot = { ...this.status };
    if (error) snapshot.error = String(error.message || error);
    this.emit('status', snapshot);
  }

  stop() {
    this.running = false;
    this.stopRetrying();
    if (this.port?.isOpen) {
      try { this.port.close(); } catch (_) {}
    }
    this.port = null;
    this.connected = false;
    this.emitStatus();
  }
}

export default FingerprintSerial;
