import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../src/components/resources/DashboardPage';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('DashboardPage', () => {
  it('shows loading state initially', () => {
    global.fetch.mockImplementationOnce(() => new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument();
  });

  it('renders stats from API', async () => {
    const mockStats = {
      population: { total: 150, today_registered: 5, today_checkins: 12, families: 40 },
      vulnerable: { pregnant: 3, chronic_illness: 7, total_flagged: 10 },
      distribution_today: {
        breakfast: { served: 80, pending: 20, percent: 80 },
        lunch: { served: 70, pending: 30, percent: 70 },
        dinner: { served: 60, pending: 40, percent: 60 },
        water: { served: 90, pending: 10, percent: 90 },
      },
      prediction_tomorrow: { expected_persons: 165, breakfast_kg: 82.5, water_litres: 2475 },
      mqtt: { network_state: 'STABLE', buffered_messages: 0 },
      recent_registrations: [],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Camp Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/150/)).toBeInTheDocument();
      expect(screen.getByText(/165/)).toBeInTheDocument();
    });

    expect(screen.getByText(/STABLE/i)).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Failed to load'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load dashboard/i)).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Retry/i)).toBeInTheDocument();
    });
  });
});
