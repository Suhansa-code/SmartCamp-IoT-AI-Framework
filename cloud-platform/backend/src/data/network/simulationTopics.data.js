// Mock MQTT topics used by the simulation service for demo traffic.

export const SIMULATION_TOPICS = [
  { topic: 'camp/sensor/temperature', source: 'Temperature Sensor' },
  { topic: 'camp/sensor/humidity', source: 'Humidity Sensor' },
  { topic: 'camp/sensor/gps', source: 'GPS Module' },
  { topic: 'camp/sensor/water', source: 'Water Quality Monitor' },
  { topic: 'camp/alert/emergency', source: 'Emergency System' },
  { topic: 'camp/status/heartbeat', source: 'Heartbeat Monitor' },
];

export const SIMULATION_ACTIONS = ['publish', 'data', 'ack', 'ping'];

export const OFFLINE_METRICS = {
  rtt_avg: 999,
  rtt_max: 999,
  packet_loss: 100,
  bandwidth: 0,
  connected: false,
};
