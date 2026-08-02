import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('mqtt', () => ({
  default: {
    connect: vi.fn(() => ({
      on: vi.fn(),
      subscribe: vi.fn(),
      publish: vi.fn(),
      end: vi.fn(),
    })),
  },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => 'fake-cert'),
    existsSync: vi.fn(() => true),
  },
}));

vi.mock('../../config/database.js', () => ({
  campDb: {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      all: vi.fn(() => []),
      get: vi.fn(),
    })),
  },
}));

let saamp;

beforeAll(async () => {
  saamp = await import('../../services/network/saamp-mqtt.js');
});

describe('classifyMessage', () => {
  it('classifies fingerprint_scanner|new_registration as CRITICAL QoS 2', () => {
    expect(saamp.classifyMessage('fingerprint_scanner', 'new_registration'))
      .toEqual({ priority: 'CRITICAL', qos: 2 });
  });

  it('classifies fingerprint_scanner|checkin as CRITICAL QoS 2', () => {
    expect(saamp.classifyMessage('fingerprint_scanner', 'checkin'))
      .toEqual({ priority: 'CRITICAL', qos: 2 });
  });

  it('classifies wristband_scanner|distribution as CRITICAL QoS 2', () => {
    expect(saamp.classifyMessage('wristband_scanner', 'distribution'))
      .toEqual({ priority: 'CRITICAL', qos: 2 });
  });

  it('classifies prediction_model|daily_forecast as HIGH QoS 1', () => {
    expect(saamp.classifyMessage('prediction_model', 'daily_forecast'))
      .toEqual({ priority: 'HIGH', qos: 1 });
  });

  it('classifies system|heartbeat as LOW QoS 0', () => {
    expect(saamp.classifyMessage('system', 'heartbeat'))
      .toEqual({ priority: 'LOW', qos: 0 });
  });

  it('classifies dashboard|status_poll as LOW QoS 0', () => {
    expect(saamp.classifyMessage('dashboard', 'status_poll'))
      .toEqual({ priority: 'LOW', qos: 0 });
  });

  it('classifies system|network_state as MEDIUM QoS 1', () => {
    expect(saamp.classifyMessage('system', 'network_state'))
      .toEqual({ priority: 'MEDIUM', qos: 1 });
  });

  it('defaults unknown source|action to MEDIUM QoS 1', () => {
    expect(saamp.classifyMessage('unknown_source', 'unknown_action'))
      .toEqual({ priority: 'MEDIUM', qos: 1 });
  });
});

describe('decideAdaptiveQoS', () => {
  describe('STABLE network', () => {
    it('returns base QoS with publish action for all priorities', () => {
      expect(saamp.decideAdaptiveQoS('CRITICAL', 2, 'STABLE'))
        .toEqual({ qos: 2, action: 'publish' });
      expect(saamp.decideAdaptiveQoS('LOW', 0, 'STABLE'))
        .toEqual({ qos: 0, action: 'publish' });
    });
  });

  describe('DEGRADED network', () => {
    it('escalates CRITICAL to QoS 2', () => {
      expect(saamp.decideAdaptiveQoS('CRITICAL', 2, 'DEGRADED'))
        .toEqual({ qos: 2, action: 'publish' });
    });

    it('escalates HIGH to QoS 2', () => {
      expect(saamp.decideAdaptiveQoS('HIGH', 1, 'DEGRADED'))
        .toEqual({ qos: 2, action: 'publish' });
    });

    it('publishes MEDIUM at QoS 1', () => {
      expect(saamp.decideAdaptiveQoS('MEDIUM', 1, 'DEGRADED'))
        .toEqual({ qos: 1, action: 'publish' });
    });

    it('publishes LOW at QoS 1', () => {
      expect(saamp.decideAdaptiveQoS('LOW', 0, 'DEGRADED'))
        .toEqual({ qos: 1, action: 'publish' });
    });
  });

  describe('CRITICAL network', () => {
    it('publishes CRITICAL messages at QoS 1', () => {
      expect(saamp.decideAdaptiveQoS('CRITICAL', 2, 'CRITICAL'))
        .toEqual({ qos: 1, action: 'publish' });
    });

    it('buffers HIGH messages', () => {
      expect(saamp.decideAdaptiveQoS('HIGH', 1, 'CRITICAL'))
        .toEqual({ qos: 1, action: 'buffer' });
    });

    it('buffers MEDIUM messages', () => {
      expect(saamp.decideAdaptiveQoS('MEDIUM', 1, 'CRITICAL'))
        .toEqual({ qos: 1, action: 'buffer' });
    });

    it('buffers LOW messages', () => {
      expect(saamp.decideAdaptiveQoS('LOW', 0, 'CRITICAL'))
        .toEqual({ qos: 0, action: 'buffer' });
    });
  });
});
