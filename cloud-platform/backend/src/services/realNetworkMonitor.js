import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RealNetworkMonitor {
  constructor() {
    this.targetHost = '8.8.8.8';
    this.lastPingResults = [];
    this.maxHistory = 60;
  }

  async measurePing() {
    try {
      const { stdout } = await execAsync(`ping -c 5 ${this.targetHost}`, { timeout: 10000 });
      return this.parsePingOutput(stdout);
    } catch (error) {
      return { rtt_avg: 999, rtt_max: 999, packet_loss: 100, jitter: 0 };
    }
  }

  parsePingOutput(output) {
    const lines = output.split('\n');
    let rtt_avg = 0, rtt_max = 0, packet_loss = 0, jitter = 0;

    const lossMatch = output.match(/(\d+)% packet loss/);
    if (lossMatch) packet_loss = parseFloat(lossMatch[1]);

    const statsMatch = lines.find(l => l.includes('rtt min/avg/max/mdev'));
    if (statsMatch) {
      const match = statsMatch.match(/(\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*)/);
      if (match) {
        rtt_avg = parseFloat(match[2]);
        rtt_max = parseFloat(match[3]);
        jitter = parseFloat(match[4]);
      }
    }

    return { rtt_avg, rtt_max, packet_loss, jitter };
  }

  async measureBandwidth() {
    try {
      const { stdout } = await execAsync(`ping -c 5 -s 1000 ${this.targetHost}`, { timeout: 10000 });
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/time=(\d+\.?\d*)/g);
        if (match) {
          const times = match.map(m => parseFloat(m.replace('time=', '')));
          const avgTime = times.reduce((a,b) => a + b, 0) / times.length;
          if (avgTime > 0) {
            const throughput = Math.round((8000 / avgTime) * 10) / 10;
            return throughput;
          }
        }
      }
    } catch {}
    return 0;
  }

  async measureNetworkStats() {
    const [pingResult, bandwidth] = await Promise.all([
      this.measurePing(),
      this.measureBandwidth()
    ]);

    return {
      rtt_avg: Math.round(pingResult.rtt_avg * 100) / 100,
      rtt_max: Math.round(pingResult.rtt_max * 100) / 100,
      packet_loss: Math.round(pingResult.packet_loss * 100) / 100,
      jitter: Math.round(pingResult.jitter * 100) / 100,
      bandwidth,
      connected: pingResult.packet_loss < 100
    };
  }
}
