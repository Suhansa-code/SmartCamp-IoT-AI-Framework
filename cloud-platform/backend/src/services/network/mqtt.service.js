import mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { env } from '../../config/env.js';

export class MqttService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
  }

  async connect() {
    const options = {
      username: env.mqtt.username,
      password: env.mqtt.password,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    };

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(env.mqtt.brokerUrl, options);

      this.client.on('connect', () => {
        this.connected = true;
        console.log('[MQTT] Connected to broker');
        this.emit('connected');
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('[MQTT] Error:', error.message);
        this.emit('error', error);
      });

      this.client.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
      });

      this.client.on('message', (topic, payload) => {
        this.emit('message', topic, JSON.parse(payload.toString()));
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] Reconnecting...');
      });
    });
  }

  subscribe(topic, callback) {
    if (!this.client || !this.connected) {
      console.warn('[MQTT] Cannot subscribe - not connected');
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`[MQTT] Subscribe error for ${topic}:`, err.message);
      } else {
        console.log(`[MQTT] Subscribed to ${topic}`);
        this.subscriptions.set(topic, callback);
      }
    });
  }

  publish(topic, message) {
    if (!this.client || !this.connected) {
      console.warn('[MQTT] Cannot publish - not connected');
      return;
    }

    this.client.publish(topic, JSON.stringify(message));
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected;
  }
}