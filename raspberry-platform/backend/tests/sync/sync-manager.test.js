import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('mqtt', () => ({
  default: { connect: vi.fn(() => ({ on: vi.fn(), subscribe: vi.fn(), publish: vi.fn(), end: vi.fn() })) },
}));
vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(() => 'cert'), existsSync: vi.fn(() => true) },
}));

const mockPrepare = vi.fn(() => ({
  run: vi.fn(), get: vi.fn(() => ({ cnt: 0 })), all: vi.fn(() => []),
}));

vi.mock('../../config/database.js', () => ({
  campDb: { prepare: mockPrepare, transaction: (fn) => fn },
  pagesDb: { prepare: mockPrepare },
  disasterDb: { prepare: mockPrepare },
}));

let saamp, syncManager;

beforeAll(async () => {
  saamp = await import('../../services/network/saamp-mqtt.js');
  syncManager = await import('../../services/sync/sync-manager.js');
});

describe('sync-manager — exports', () => {
  it('exports startSync, stopSync, getSyncStatus, runSyncCycle', () => {
    expect(typeof syncManager.startSync).toBe('function');
    expect(typeof syncManager.stopSync).toBe('function');
    expect(typeof syncManager.getSyncStatus).toBe('function');
    expect(typeof syncManager.runSyncCycle).toBe('function');
  });

  it('exports TABLE_TO_ENTITY mapping for all 21 entities', () => {
    const entities = Object.values(syncManager.TABLE_TO_ENTITY);
    expect(entities).toContain('persons');
    expect(entities).toContain('checkins');
    expect(entities).toContain('wristbands');
    expect(entities).toContain('distributions');
    expect(entities).toContain('resources');
    expect(entities).toContain('resource-usage');
    expect(entities).toContain('audit-logs');
    expect(entities).toContain('children');
    expect(entities).toContain('sessions');
    expect(entities).toContain('behavioral-signals');
    expect(entities).toContain('gate-decisions');
    expect(entities).toContain('alerts');
    expect(entities).toContain('content-responses');
    expect(entities).toContain('disaster-events');
    expect(entities).toContain('water-level-readings');
    expect(entities).toContain('gps-readings');
    expect(entities).toContain('weather-data');
    expect(entities).toContain('hydrospatial-data');
    expect(entities).toContain('flood-predictions');
    expect(entities).toContain('disaster-alerts');
    expect(entities).toContain('prediction-requests');
  });

  it('exports ENTITY_PK with correct primary keys', () => {
    expect(syncManager.ENTITY_PK.persons).toBe('id');
    expect(syncManager.ENTITY_PK.children).toBe('child_id');
    expect(syncManager.ENTITY_PK.sessions).toBe('session_id');
    expect(syncManager.ENTITY_PK.alerts).toBe('alert_id');
  });
});

describe('sync-manager — getSyncStatus', () => {
  it('returns structured status object', () => {
    const status = syncManager.getSyncStatus();
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('timer_active');
    expect(status).toHaveProperty('last_sync');
    expect(status).toHaveProperty('total_cycles');
    expect(status).toHaveProperty('network_state');
    expect(status).toHaveProperty('mqtt_connected');
    expect(status).toHaveProperty('pending');
  });
});

describe('sync-manager — SAAMP flush integration', () => {
  it('SAAMP onFlush is a function', () => {
    expect(typeof saamp.onFlush).toBe('function');
  });

  it('SAAMP isConnectedToBroker is a function', () => {
    expect(typeof saamp.isConnectedToBroker).toBe('function');
  });

  it('SAAMP getNetworkState returns a string', () => {
    expect(typeof saamp.getNetworkState()).toBe('string');
  });
});
