import { RealNetworkMonitor } from './realNetworkMonitor.service.js';

export class SimulationService {
  constructor(networkMonitor) {
    this.networkMonitor = networkMonitor;
    this.intervalId = null;
    this.realMonitor = new RealNetworkMonitor();
  }

  async start() {
    console.log('[Monitor] Starting real network monitoring...');
    this.intervalId = setInterval(() => this.tick(), 3000);
    await this.tick();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async tick() {
    try {
      const realStats = await this.realMonitor.measureNetworkStats();

      this.networkMonitor.updateSimulatedMetrics({
        rtt_avg: realStats.rtt_avg,
        rtt_max: realStats.rtt_max,
        packet_loss: realStats.packet_loss,
        jitter: realStats.jitter,
        bandwidth: realStats.bandwidth,
        queue_depth: Math.floor(Math.random() * 20),
        drop_rate: Math.random() * 0.5,
        bridge_alive: true,
        clients: Math.floor(3 + Math.random() * 5),
        queue_delta: Math.floor(-5 + Math.random() * 10),
        hour_of_day: new Date().getHours(),
        connected: realStats.connected,
      });

      if (Math.random() < 0.3) {
        this.simulateMessageTraffic();
      }
    } catch (error) {
      console.error('[Monitor] Error measuring network:', error.message);
      this.networkMonitor.updateSimulatedMetrics({
        rtt_avg: 999,
        rtt_max: 999,
        packet_loss: 100,
        bandwidth: 0,
        connected: false,
      });
    }
  }

  simulateMessageTraffic() {
    const topics = [
      { topic: 'camp/sensor/temperature', source: 'Temperature Sensor' },
      { topic: 'camp/sensor/humidity', source: 'Humidity Sensor' },
      { topic: 'camp/sensor/gps', source: 'GPS Module' },
      { topic: 'camp/sensor/water', source: 'Water Quality Monitor' },
      { topic: 'camp/alert/emergency', source: 'Emergency System' },
      { topic: 'camp/status/heartbeat', source: 'Heartbeat Monitor' },
    ];

    const topicInfo = topics[Math.floor(Math.random() * topics.length)];
    const payload = {
      source: topicInfo.source,
      action: ['publish', 'data', 'ack', 'ping'][Math.floor(Math.random() * 4)],
      timestamp: Date.now(),
      priority: Math.random() < 0.1 ? 'high' : 'normal',
    };

    this.networkMonitor.incrementMessage(100 + Math.floor(Math.random() * 500));
    this.networkMonitor.handleMessage(topicInfo.topic, payload);
  }
}