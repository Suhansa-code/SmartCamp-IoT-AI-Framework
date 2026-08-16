import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockTransaction = vi.fn((fn) => fn);
const mockDb = {
  prepare: vi.fn(() => ({ run: mockRun, get: mockGet })),
  transaction: mockTransaction,
};

vi.mock('../../config/database.js', () => ({ campDb: mockDb }));

const mockPublishAsClient = vi.fn();
vi.mock('../../services/network/saamp-mqtt.js', () => ({
  publishAsClient: mockPublishAsClient,
}));

const mockCreateMqttUser = vi.fn();
vi.mock('../../services/network/emqx-manager.js', () => ({
  createMqttUser: mockCreateMqttUser,
}));

vi.mock('../../utils/crypto.js', () => ({
  genId: vi.fn((prefix) => `${prefix}_test123`),
  genPassword: vi.fn(() => 'testpass123'),
}));

let register;
beforeAll(async () => {
  register = await import('../../services/resource/register.js');
});

describe('registerPerson', () => {
  const personRow = {
    id: 42, fingerprint_id: 'FP_test123', full_name: 'Test Person',
    age: 25, gender: 'M', person_type: 'refugee',
    family_unit_id: 'FAM_test123', family_size: 3,
    is_pregnant: 0, has_chronic_illness: 0, medical_notes: '',
    pre_registered: 0, created_at: '2026-07-30 22:00:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({ lastInsertRowid: 42 });
    mockGet.mockReturnValue(personRow);
    mockPublishAsClient.mockResolvedValue({ published: true, action: 'publish' });
    mockCreateMqttUser.mockResolvedValue({ ok: true });
  });

  function mockNoDuplicate() {
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return undefined;
      return personRow;
    });
  }

  const baseData = { full_name: 'Test Person', age: 25, gender: 'M' };

  it('inserts person, checkin, and wristband in sequence', async () => {
    mockNoDuplicate();
    await register.registerPerson(baseData);

    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO persons'))).toBe(true);
    expect(sqlCalls.some(s => s.includes('INSERT INTO camp_checkins'))).toBe(true);
    expect(sqlCalls.some(s => s.includes('INSERT INTO wristbands'))).toBe(true);
  });

  it('returns person data with wristband barcode', async () => {
    mockNoDuplicate();
    const result = await register.registerPerson(baseData);
    expect(result.person).toBeDefined();
    expect(result.person.id).toBe(42);
    expect(result.wristband_barcode).toBe('WB000042');
  });

  it('applies defaults for optional fields', async () => {
    mockNoDuplicate();
    await register.registerPerson({ full_name: 'Minimal', age: 30 });

    const personsRun = mockRun.mock.calls[0];
    expect(personsRun[4]).toBe('refugee');
    expect(personsRun[6]).toBe(1);
    expect(personsRun[7]).toBe(0);
    expect(personsRun[8]).toBe(0);
    expect(personsRun[9]).toBe('');
  });

  it('defaults family_size to 1 when missing', async () => {
    mockNoDuplicate();
    await register.registerPerson({ full_name: 'No Family Size', age: 40 });

    const personsRun = mockRun.mock.calls[0];
    expect(personsRun[6]).toBe(1);
  });

  it('generates fingerprint_id with FP_ prefix', async () => {
    mockNoDuplicate();
    await register.registerPerson({ full_name: 'Format Test', age: 30 });
    expect(mockRun.mock.calls[0][0]).toMatch(/^FP_/);
  });

  it('throws 400 when full_name is missing', async () => {
    await expect(register.registerPerson({ age: 25 })).rejects.toThrow('Validation failed');
  });

  it('throws 400 when age is missing', async () => {
    await expect(register.registerPerson({ full_name: 'No Age' })).rejects.toThrow('Validation failed');
  });

  it('throws 400 for invalid age range', async () => {
    await expect(register.registerPerson({ full_name: 'Bad', age: -5 })).rejects.toThrow('Validation failed');
  });

  it('throws 409 for duplicate registration', async () => {
    mockGet.mockReturnValue({ id: 99 });
    await expect(register.registerPerson(baseData)).rejects.toThrow('already exists');
  });

  it('continues when MQTT fails', async () => {
    mockNoDuplicate();
    mockCreateMqttUser.mockRejectedValue(new Error('MQTT down'));
    const result = await register.registerPerson(baseData);
    expect(result.person).toBeDefined();
    expect(result.mqtt.error).toContain('MQTT down');
  });

  it('uses transaction for inserts', async () => {
    mockNoDuplicate();
    await register.registerPerson(baseData);
    expect(mockTransaction).toHaveBeenCalled();
  });
});
