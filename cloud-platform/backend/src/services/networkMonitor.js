import { EventEmitter } from 'events';

export class NetworkMonitor extends EventEmitter {
  constructor(mqttService) {
    super();
    this.mqttService = mqttService;
    this.connected = false;
    this.metrics = {
      rtt_avg: 0,
      rtt_max: 0,
      packet_loss: 0,
      queue_depth: 0,
      throughput: 0,
      bandwidth: 0,
      jitter: 0,
      drop_rate: 0,
      bridge_alive: false,
      clients: 0,
      queue_delta: 0,
      hour_of_day: new Date().getHours()
    };
    this.networkState = 'OFFLINE';
    this.predictedState = 'UNKNOWN';
    this.messages = [];
    this.buffer = [];
    this.history = [];
    this.deliveryStats = {
      total_sent: 0,
      total_delivered: 0,
      total_dropped: 0,
      total_buffered: 0,
      delivery_rate: 100
    };
    this.messageCount = 0;
    this.bytesCount = 0;
    this.lastThroughputCheck = Date.now();
    this.intervalId = null;
  }

  start() {
    this.mqttService.on('connected', () => {
      this.connected = true;
      this.metrics.bridge_alive = true;
    });

    this.mqttService.on('disconnected', () => {
      this.connected = false;
      this.metrics.bridge_alive = false;
      this.updateNetworkState();
    });

    this.mqttService.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    this.intervalId = setInterval(() => this.updateMetrics(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  handleMessage(topic, payload) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source: payload.source || topic,
      action: payload.action || 'unknown',
      priority: this.calculatePriority(payload),
      topic,
      status: 'sent',
      qos_assigned: 0
    };

    const qosDecision = this.makeQosDecision(payload);
    message.qos_assigned = qosDecision.qos;
    message.status = qosDecision.action;

    this.messages.unshift(message);
    if (this.messages.length > 100) {
      this.messages.pop();
    }

    if (message.status === 'buffered') {
      this.buffer.push(message);
      this.metrics.queue_depth++;
    }

    this.updateDeliveryStats(message.status);
    this.emit('message', message);
  }

  calculatePriority(payload) {
    if (payload.critical || payload.alert) return 'CRITICAL';
    if (payload.important || payload.priority === 'high') return 'IMPORTANT';
    return 'ROUTINE';
  }

  makeQosDecision(payload) {
    const state = this.networkState;
    const priority = this.calculatePriority(payload);

    if (state === 'GOOD') {
      return { qos: 2, action: 'sent' };
    } else if (state === 'WEAK') {
      if (priority === 'CRITICAL') return { qos: 2, action: 'sent' };
      return { qos: 1, action: priority === 'IMPORTANT' ? 'sent' : 'buffered' };
    } else if (state === 'POOR') {
      if (priority === 'CRITICAL') return { qos: 1, action: 'sent' };
      return { qos: 0, action: 'buffered' };
    }
    return { qos: 0, action: 'buffered' };
  }

  updateDeliveryStats(status) {
    this.deliveryStats.total_sent++;
    switch (status) {
      case 'sent':
        this.deliveryStats.total_delivered++;
        break;
      case 'dropped':
        this.deliveryStats.total_dropped++;
        break;
      case 'buffered':
        this.deliveryStats.total_buffered++;
        break;
    }
    const total = this.deliveryStats.total_sent;
    if (total > 0) {
      this.deliveryStats.delivery_rate = Math.round(
        (this.deliveryStats.total_delivered / total) * 100
      );
    }
  }

  updateMetrics() {
    const now = Date.now();
    const elapsed = (now - this.lastThroughputCheck) / 1000;

    if (elapsed >= 1) {
      this.metrics.throughput = Math.round(this.messageCount / elapsed);
      this.metrics.bandwidth = Math.round((this.bytesCount / elapsed) / 1024);
      this.messageCount = 0;
      this.bytesCount = 0;
      this.lastThroughputCheck = now;
    }

    this.metrics.hour_of_day = new Date().getHours();
    this.updateNetworkState();
    this.predictState();

    this.history.push({
      timestamp: now,
      ...this.metrics
    });

    if (this.history.length > 1000) {
      this.history.shift();
    }

    this.emit('metrics', this.metrics);
  }

  updateNetworkState() {
    const m = this.metrics;
    let state = 'OFFLINE';

    if (this.connected) {
      if (m.rtt_avg < 100 && m.packet_loss < 1 && m.queue_depth < 50) {
        state = 'GOOD';
      } else if (m.rtt_avg < 300 && m.packet_loss < 5 && m.queue_depth < 200) {
        state = 'WEAK';
      } else if (m.rtt_avg < 1000 && m.packet_loss < 20) {
        state = 'POOR';
      } else {
        state = 'OFFLINE';
      }
    }

    this.networkState = state;
  }

  predictState() {
    const recent = this.history.slice(-60);
    if (recent.length < 10) {
      this.predictedState = this.networkState;
      return;
    }

    const avgRtt = recent.reduce((sum, h) => sum + h.rtt_avg, 0) / recent.length;
    const avgLoss = recent.reduce((sum, h) => sum + h.packet_loss, 0) / recent.length;
    const trend = recent[recent.length - 1].rtt_avg - recent[0].rtt_avg;

    if (trend > 50 || avgRtt > 500 || avgLoss > 15) {
      this.predictedState = 'DEGRADING';
    } else if (trend < -50) {
      this.predictedState = 'IMPROVING';
    } else {
      this.predictedState = 'STABLE';
    }
  }

  updateSimulatedMetrics(data) {
    Object.assign(this.metrics, data);
    this.connected = data.connected ?? this.connected;
    this.updateNetworkState();
    this.predictState();
  }

  incrementMessage(bytes = 100) {
    this.messageCount++;
    this.bytesCount += bytes;
  }

  clearBuffer() {
    this.buffer = [];
    this.metrics.queue_depth = 0;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getNetworkState() {
    return {
      network_state: this.networkState,
      predicted_state: this.predictedState,
      connected: this.connected
    };
  }

  getRecentMessages() {
    return [...this.messages];
  }

  getBuffer() {
    return [...this.buffer];
  }

  getDeliveryStats() {
    return { ...this.deliveryStats };
  }

  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  isConnected() {
    return this.connected;
  }
}
