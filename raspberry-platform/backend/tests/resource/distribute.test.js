import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockGet = vi.fn();
const mockRun = vi.fn();
const mockAll = vi.fn();
const mockDb = { prepare: vi.fn(() => ({ get: mockGet, run: mockRun, all: mockAll })) };
const mockEnqueueSync = vi.fn();

vi.mock('../../config/database.js', () => ({ campDb: mockDb }));
vi.mock('../../services/sync/sync-notify.js', () => ({ enqueueSync: mockEnqueueSync }));

vi.mock('../../services/network/saamp-mqtt.js', () => ({
  publishAsClient: vi.fn(() => Promise.resolve({ published: true, action: 'publish' })),
  publish: vi.fn(() => ({ published: true, action: 'publish' })),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => JSON.stringify({
      standard: { breakfast: 0.5, lunch: 1.0, dinner: 0.8, water: 2.0 },
      pregnant_extra: { breakfast: 0.2, lunch: 0.3, dinner: 0.2, water: 1.0 },
    })),
  },
}));

let distribute;
beforeAll(async () => {
  distribute = await import('../../services/resource/distribute.js');
});

describe('distributeResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockDistributeSetup(mqttCreds = null, todayDists = []) {
    mockGet
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ barcode: 'WB001', person_id: 10 })
      .mockReturnValueOnce({ id: 10, full_name: 'Kasun', mqtt_client_id: mqttCreds?.id || null, mqtt_password: mqttCreds?.pass || null });
    mockAll.mockReturnValue(todayDists);
    mockRun.mockReturnValue({ lastInsertRowid: 42 });
  }

  it('distributes a valid resource type', async () => {
    mockDistributeSetup();
    const result = await distribute.distributeResource('WB001', 'breakfast');
    expect(result.today_distributions).toBeDefined();
    expect(result.mqtt).toBeDefined();
  });

  it('throws 400 for invalid resource type', async () => {
    await expect(distribute.distributeResource('WB001', 'invalid')).rejects.toThrow('Invalid resource_type');
  });

  it('throws 400 when resource already distributed today', async () => {
    mockGet.mockReturnValue({ id: 1 });
    await expect(distribute.distributeResource('WB001', 'breakfast')).rejects.toThrow('already distributed today');
  });

  it('inserts distribution record', async () => {
    mockDistributeSetup();
    await distribute.distributeResource('WB001', 'lunch');
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO distributions'))).toBe(true);
    expect(mockEnqueueSync).toHaveBeenCalledWith('distributions', 42);
  });

  it('publishes water distributions through the shared connection', async () => {
    mockGet
      .mockReturnValueOnce({ total: 0 })
      .mockReturnValueOnce({ barcode: 'WB001', person_id: 10 })
      .mockReturnValueOnce({ id: 10, full_name: 'Kasun' })
      .mockReturnValueOnce({ total: 2 });
    mockAll.mockReturnValue([{ resource_type: 'water' }]);
    mockRun.mockReturnValue({ lastInsertRowid: 43 });
    await distribute.distributeResource('WB001', 'water');
    const saamp = await import('../../services/network/saamp-mqtt.js');
    expect(saamp.publish).toHaveBeenCalled();
    expect(mockEnqueueSync).toHaveBeenCalledWith('distributions', 43);
  });

  it('returns correct today_distributions state', async () => {
    mockDistributeSetup(null, [
      { resource_type: 'breakfast' }, { resource_type: 'lunch' },
      { resource_type: 'water' }, { resource_type: 'dinner' },
    ]);
    const result = await distribute.distributeResource('WB001', 'lunch');
    expect(result.today_distributions.breakfast).toBe(true);
    expect(result.today_distributions.lunch).toBe(true);
    expect(result.today_distributions.dinner).toBe(true);
    expect(result.today_distributions.water).toBe(true);
  });
});
