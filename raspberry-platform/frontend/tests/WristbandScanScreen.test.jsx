import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WristbandScanScreen from '../src/components/resources/WristbandScanScreen';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('WristbandScanScreen', () => {
  it('renders the lookup form', () => {
    render(<WristbandScanScreen />);
    expect(screen.getByText(/Distribution Hub/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/WB000001/i)).toBeInTheDocument();
  });

  it('shows error for invalid barcode (waits 600ms setTimeout)', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ error: 'Wristband not found' }),
    });

    render(<WristbandScanScreen />);
    await userEvent.type(screen.getByPlaceholderText(/WB000001/i), 'INVALID');
    await userEvent.click(screen.getByText(/Lookup/i));

    await screen.findByText(/Wristband not found/i, {}, { timeout: 3000 });
  });

  it('shows profile and distribution tiles on successful scan', async () => {
    const person = { full_name: 'John Smith', age: 35, gender: 'M', family_unit_id: 'FAM_001', is_pregnant: 0, has_chronic_illness: 0 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ person, today_distributions: { breakfast: false, lunch: false, dinner: false, water: false } }),
    });

    render(<WristbandScanScreen />);
    await userEvent.type(screen.getByPlaceholderText(/WB000001/i), 'WB000042');
    await userEvent.click(screen.getByText(/Lookup/i));

    expect(await screen.findByText(/John Smith/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Breakfast/i)).toBeInTheDocument();
    expect(screen.getByText(/Lunch/i)).toBeInTheDocument();
    expect(screen.getByText(/Dinner/i)).toBeInTheDocument();
    expect(screen.getByText(/Water/i)).toBeInTheDocument();
  });

  it('distributes a resource when button is clicked', async () => {
    const person = { full_name: 'Alice', age: 28, gender: 'F', family_unit_id: 'FAM_002', is_pregnant: 0, has_chronic_illness: 0 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ person, today_distributions: { breakfast: false, lunch: false, dinner: false, water: false } }),
    });

    render(<WristbandScanScreen />);
    await userEvent.type(screen.getByPlaceholderText(/WB000001/i), 'WB000042');
    await userEvent.click(screen.getByText(/Lookup/i));

    await screen.findByText(/Alice/i, {}, { timeout: 3000 });

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        today_distributions: { breakfast: true, lunch: false, dinner: false, water: false },
        mqtt: { priority: 'CRITICAL', final_qos: 2, network_state: 'STABLE', published: true },
      }),
    });

    await userEvent.click(screen.getAllByText(/Distribute/i)[0]);

    expect(await screen.findByText(/Breakfast distributed successfully/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('shows error when distribution fails', async () => {
    const person = { full_name: 'Bob', age: 40, gender: 'M', family_unit_id: 'FAM_003', is_pregnant: 0, has_chronic_illness: 0 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ person, today_distributions: { breakfast: false, lunch: false, dinner: false, water: false } }),
    });

    render(<WristbandScanScreen />);
    await userEvent.type(screen.getByPlaceholderText(/WB000001/i), 'WB000042');
    await userEvent.click(screen.getByText(/Lookup/i));

    await screen.findByText(/Bob/i, {}, { timeout: 3000 });

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ error: 'Already distributed today' }),
    });

    await userEvent.click(screen.getAllByText(/Distribute/i)[0]);

    expect(await screen.findByText(/Already distributed today/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
