import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NetworkScreen from '../src/components/resources/NetworkScreen';

class EventSourceStub {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const status = {
  state: 'DEGRADED',
  updated_at: new Date().toISOString(),
  metrics: {
    rtt_avg: 380, packet_loss: 6.2, jitter: 45, broker_rtt: 410,
    bridge_alive: true, queue_depth: 8,
  },
  diagnostics: { stale: false, qos_source: 'model', qos_policy: { CRITICAL: 2, HIGH: 2, MEDIUM: 1, LOW: 1 } },
  buffered_messages: 2,
  buffer_by_priority: [
    { priority: 'CRITICAL', flush_position: 1, count: 1, oldest_at: null },
    { priority: 'HIGH', flush_position: 2, count: 1, oldest_at: null },
    { priority: 'MEDIUM', flush_position: 3, count: 0, oldest_at: null },
    { priority: 'LOW', flush_position: 4, count: 0, oldest_at: null },
  ],
  history: [],
};

beforeEach(() => {
  vi.stubGlobal('EventSource', EventSourceStub);
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(status) }));
});

afterEach(() => vi.unstubAllGlobals());

describe('NetworkScreen', () => {
  it('shows the current adaptive policy and QoS health snapshot', async () => {
    render(<NetworkScreen />);

    await waitFor(() => expect(screen.getByText('DEGRADED')).toBeInTheDocument());
    expect(screen.getByText('Adaptive action')).toBeInTheDocument();
    expect(screen.getAllByText('Publish · QoS 2')).toHaveLength(2);
    expect(screen.getByText('Waiting for two QoS samples')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
