import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { NetworkMonitor } from '../../src/services/network/networkMonitor.service.js';

function createMonitor(state = 'GOOD') {
  const monitor = new NetworkMonitor(new EventEmitter());
  monitor.networkState = state;
  return monitor;
}

test('calculatePriority classifies payloads', () => {
  const monitor = createMonitor();
  assert.equal(monitor.calculatePriority({ critical: true }), 'CRITICAL');
  assert.equal(monitor.calculatePriority({ alert: true }), 'CRITICAL');
  assert.equal(monitor.calculatePriority({ important: true }), 'IMPORTANT');
  assert.equal(monitor.calculatePriority({ priority: 'high' }), 'IMPORTANT');
  assert.equal(monitor.calculatePriority({}), 'ROUTINE');
});

test('makeQosDecision — GOOD network sends at QoS 2', () => {
  const monitor = createMonitor('GOOD');
  assert.deepEqual(monitor.makeQosDecision({}), { qos: 2, action: 'sent' });
});

test('makeQosDecision — WEAK network buffers routine messages', () => {
  const monitor = createMonitor('WEAK');
  assert.deepEqual(monitor.makeQosDecision({}), { qos: 1, action: 'buffered' });
  assert.deepEqual(monitor.makeQosDecision({ important: true }), { qos: 1, action: 'sent' });
  assert.deepEqual(monitor.makeQosDecision({ critical: true }), { qos: 2, action: 'sent' });
});

test('makeQosDecision — POOR network sends only critical', () => {
  const monitor = createMonitor('POOR');
  assert.deepEqual(monitor.makeQosDecision({ critical: true }), { qos: 1, action: 'sent' });
  assert.deepEqual(monitor.makeQosDecision({}), { qos: 0, action: 'buffered' });
});

test('handleMessage updates delivery stats', () => {
  const monitor = createMonitor('GOOD');
  monitor.handleMessage('camp/sensor/temp', { source: 'T1', action: 'publish' });
  assert.equal(monitor.getDeliveryStats().total_sent, 1);
  assert.equal(monitor.getDeliveryStats().total_delivered, 1);
});

test('updateNetworkState derives state from metrics', () => {
  const monitor = createMonitor();
  monitor.connected = true;
  monitor.metrics = { rtt_avg: 50, packet_loss: 0.2, queue_depth: 10 };
  monitor.updateNetworkState();
  assert.equal(monitor.networkState, 'GOOD');

  monitor.metrics = { rtt_avg: 200, packet_loss: 2, queue_depth: 60 };
  monitor.updateNetworkState();
  assert.equal(monitor.networkState, 'WEAK');
});

test('getNetworkState returns dashboard contract', () => {
  const monitor = createMonitor('GOOD');
  const state = monitor.getNetworkState();
  assert.equal(state.network_state, 'GOOD');
  assert.ok('predicted_state' in state);
  assert.ok('connected' in state);
});