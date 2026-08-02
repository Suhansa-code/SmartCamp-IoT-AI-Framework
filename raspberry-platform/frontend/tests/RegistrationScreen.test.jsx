import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationScreen from '../src/components/resources/RegistrationScreen';

beforeEach(() => {
  cleanup();
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('RegistrationScreen', () => {
  it('renders the scan button in idle state', () => {
    render(<RegistrationScreen />);
    expect(screen.getByText(/Initiate Scan/i)).toBeInTheDocument();
  });

  it('opens new-person form directly via Test Registration button', async () => {
    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Test Registration/i));

    expect(screen.getByText(/New Registration/i)).toBeInTheDocument();
  });

  it('shows error when scan API fails (no setTimeout in catch)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/Scanner offline or error/i)).toBeInTheDocument();
    });
  });

  it('shows no-match decision when scan returns not_found (waits 1500ms setTimeout)', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: false }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/No Fingerprint Match/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText(/New to the camp/i)).toBeInTheDocument();
    expect(screen.getByText(/Returning member/i)).toBeInTheDocument();
  });

  it('opens registration form via the New to the camp option', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: false }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/New to the camp/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    await userEvent.click(screen.getByText(/New to the camp/i));
    expect(screen.getByText(/New Registration/i)).toBeInTheDocument();
  });

  it('shows profile when fingerprint matches', async () => {
    const person = { id: 1, full_name: 'Test Person', age: 25, gender: 'M', family_size: 2 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: true, person }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/Test Person/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getAllByText(/Identity Verified/i).length).toBeGreaterThanOrEqual(1);
  });

  it('submits registration form and shows success', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: false }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/New to the camp/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    await userEvent.click(screen.getByText(/New to the camp/i));
    expect(screen.getByText(/New Registration/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/e.g. John Doe/i), 'Jane Doe');
    await userEvent.type(screen.getByPlaceholderText(/Years/i), '30');

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        person: { id: 2, full_name: 'Jane Doe', age: 30 },
        wristband_barcode: 'WB000002',
        mqtt: { final_qos: 2, published: true },
      }),
    });

    await userEvent.click(screen.getByText(/Enroll & Issue Wristband/i));

    await waitFor(() => {
      expect(screen.getByText(/Ready to Go/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/WB000002/i).length).toBeGreaterThanOrEqual(1);
  });

  it('searches and finds a returning member, then re-enrolls fingerprint', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: false }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/Returning member/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    await userEvent.click(screen.getByText(/Returning member/i));
    expect(screen.getByText(/Search by name, fingerprint ID, or wristband/i)).toBeInTheDocument();

    const returningPerson = {
      id: 7,
      full_name: 'Kasun Perera',
      age: 34,
      gender: 'M',
      family_size: 4,
      wristband_barcode: 'WB000001',
    };

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ results: [returningPerson] }),
    });

    await userEvent.type(screen.getByPlaceholderText(/e.g. Kasun Perera/i), 'Kasun');
    await userEvent.click(screen.getByText(/Search Records/i));

    await waitFor(() => {
      expect(screen.getByText(/Kasun Perera/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    await userEvent.click(screen.getByText(/Kasun Perera/i));

    await waitFor(() => {
      expect(screen.getByText(/Returning Member Found/i)).toBeInTheDocument();
    });

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, person: returningPerson }),
    });
    await userEvent.click(screen.getByText(/Re-enroll Fingerprint/i));

    await waitFor(() => {
      expect(screen.getByText(/Kasun Perera/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getAllByText(/Identity Verified/i).length).toBeGreaterThanOrEqual(1);
  });
});
