import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DisasterMonitorPage from '../src/components/resources/DisasterMonitorPage';

const mockCamp = {
  id: 1,
  name: 'Galle Camp',
  type: 'Refugee Camp',
  status: 'stable',
  displaced: 1200,
  capacity: 2000,
  workers: 45,
  aid: 75,
  wl: 2.5,
  alertL: 3.0,
  minorL: 4.0,
  majorL: 5.5,
  river: 'Gin River',
  station: 'Galle Station',
  stDist: 800,
  elev: 12,
  waterPath: 'River',
  minT: 22,
  maxT: 32,
  hum: 75,
  rain: 12.5,
  precip: 10,
  avgWind: 8,
  maxWind: 15,
  pres: 1012,
  soil: 0.45,
  cloud: 30,
};

const mockModel = {
  model_name: 'xgboost_flood_risk',
  roc_auc: 0.931,
  accuracy: 0.89,
  precision: 0.87,
  recall: 0.85,
  f1: 0.86,
};

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DisasterMonitorPage', () => {
  it('shows loading state initially', () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));
    render(<DisasterMonitorPage />);
    expect(screen.getByText(/Loading disaster data/i)).toBeInTheDocument();
  });

  it('renders camp data and prediction models', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ camp: mockCamp }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ models: [mockModel] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ summary: { critical_count: 0 } }) });

    render(<DisasterMonitorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Disaster Monitoring/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Galle Camp/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1,200/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/XGBoost Flood Risk/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state when API fails', async () => {
    global.fetch.mockImplementation(() => Promise.reject(new Error('Camp fetch failed')));

    render(<DisasterMonitorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load disaster data/i)).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    global.fetch.mockImplementation(() => Promise.reject(new Error('Network error')));

    render(<DisasterMonitorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Retry/i)).toBeInTheDocument();
    });
  });

  it('shows alert level based on water level', async () => {
    const criticalCamp = { ...mockCamp, wl: 6.0 };
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ camp: criticalCamp }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ models: [mockModel] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ summary: { critical_count: 1 } }) });

    render(<DisasterMonitorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Galle Camp/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/CRITICAL/i).length).toBeGreaterThanOrEqual(1);
  });
});
