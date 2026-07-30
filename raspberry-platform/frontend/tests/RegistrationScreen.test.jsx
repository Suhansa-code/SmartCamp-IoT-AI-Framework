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

  it('shows error when scan API fails (no setTimeout in catch)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/Scanner offline or error/i)).toBeInTheDocument();
    });
  });

  it('shows form after scan returns not_found (waits 1500ms setTimeout)', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: false }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await waitFor(() => {
      expect(screen.getByText(/No profile found/i)).toBeInTheDocument();
    }, { timeout: 3000 });
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
      expect(screen.getByText(/Identity Verified/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText(/Test Person/i)).toBeInTheDocument();
  });

  it('submits registration form and shows success', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ matched: false }),
    });

    render(<RegistrationScreen />);
    await userEvent.click(screen.getByText(/Initiate Scan/i));

    await new Promise(resolve => setTimeout(resolve, 2500));

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

    await userEvent.click(screen.getByText(/Enroll & Print/i));

    await new Promise(resolve => setTimeout(resolve, 500));
    expect(screen.getByText(/Ready to Go/i)).toBeInTheDocument();
    expect(screen.getAllByText(/WB000002/i).length).toBeGreaterThanOrEqual(1);
  });
});
