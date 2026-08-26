import { RealNetworkMonitor } from './realNetworkMonitor.service.js';
import { SIMULATION_TOPICS, SIMULATION_ACTIONS, OFFLINE_METRICS } from '../../data/network/simulationTopics.data.js';

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
      this.networkMonitor.updateSimulatedMetrics(OFFLINE_METRICS);
    }
  }

  simulateMessageTraffic() {
    const topicInfo = SIMULATION_TOPICS[Math.floor(Math.random() * SIMULATION_TOPICS.length)];
    const payload = {
      source: topicInfo.source,
      action: SIMULATION_ACTIONS[Math.floor(Math.random() * SIMULATION_ACTIONS.length)],
      timestamp: Date.now(),
      priority: Math.random() < 0.1 ? 'high' : 'normal',
    };

    this.networkMonitor.incrementMessage(100 + Math.floor(Math.random() * 500));
    this.networkMonitor.handleMessage(topicInfo.topic, payload);
  }
}