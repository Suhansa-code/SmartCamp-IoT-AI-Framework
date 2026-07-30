import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockDb = { prepare: vi.fn(() => ({ run: mockRun, get: mockGet })) };

vi.mock('../../config/database.js', () => ({ campDb: mockDb }));

const mockPublishAsClient = vi.fn();
vi.mock('../../services/network/saamp-mqtt.js', () => ({
  publishAsClient: mockPublishAsClient,
}));

const mockCreateMqttUser = vi.fn();
vi.mock('../../services/network/emqx-manager.js', () => ({
  createMqttUser: mockCreateMqttUser,
}));

let register;
beforeAll(async () => {
  register = await import('../../services/resource/register.js');
});

describe('registerPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({ lastInsertRowid: 42 });
    mockGet.mockReturnValue({
      id: 42, fingerprint_id: 'FP_1740000000000', full_name: 'Test Person',
      age: 25, gender: 'M', person_type: 'refugee',
      family_unit_id: 'FAM_1740000000000', family_size: 3,
      is_pregnant: 0, has_chronic_illness: 0, medical_notes: '',
      pre_registered: 0, created_at: '2026-07-30 22:00:00',
    });
    mockPublishAsClient.mockResolvedValue({ published: true, action: 'publish' });
    mockCreateMqttUser.mockResolvedValue({ ok: true });
  });

  const baseData = { full_name: 'Test Person', age: 25, gender: 'M' };

  it('inserts person, checkin, and wristband in sequence', async () => {
    await register.registerPerson(baseData);

    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO persons'))).toBe(true);
    expect(sqlCalls.some(s => s.includes('INSERT INTO camp_checkins'))).toBe(true);
    expect(sqlCalls.some(s => s.includes('INSERT INTO wristbands'))).toBe(true);
    expect(sqlCalls.some(s => s.includes('UPDATE persons SET mqtt_client_id'))).toBe(true);
  });

  it('returns person data with wristband barcode', async () => {
    const result = await register.registerPerson(baseData);
    expect(result.person).toBeDefined();
    expect(result.person.id).toBe(42);
    expect(result.wristband_barcode).toBe('WB000042');
  });

  it('applies defaults for optional fields', async () => {
    await register.registerPerson({ full_name: 'Minimal', age: 30 });

    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const idx = sqlCalls.findIndex(s => s.includes('INSERT INTO persons'));
    const values = mockRun.mock.calls[idx];

    expect(values[4]).toBe('refugee');
    expect(values[6]).toBe(1);
    expect(values[7]).toBe(0);
    expect(values[8]).toBe(0);
    expect(values[9]).toBe('');
  });

  it('defaults family_size to 1 when 0 or missing', async () => {
    await register.registerPerson({ full_name: 'Zero Family', age: 40, family_size: 0 });

    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const idx = sqlCalls.findIndex(s => s.includes('INSERT INTO persons'));
    const values = mockRun.mock.calls[idx];

    expect(values[6]).toBe(1);
  });

  it('generates fingerprint_id with FP_ prefix followed by digits', async () => {
    await register.registerPerson({ full_name: 'Format Test', age: 30 });
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const idx = sqlCalls.findIndex(s => s.includes('INSERT INTO persons'));
    expect(mockRun.mock.calls[idx][0]).toMatch(/^FP_\d+$/);
  });
});
