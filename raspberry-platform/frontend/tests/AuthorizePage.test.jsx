import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthorizePage from '../src/components/AuthorizePage';

const mockNavigate = vi.fn();
vi.mock('../src/lib/router', () => ({
  useRouter: () => ({ navigate: mockNavigate, path: '/authorize' }),
}));

const mockLogin = vi.fn();
const mockUseAuth = vi.fn(() => ({ isAuthenticated: false, login: mockLogin }));
vi.mock('../src/lib/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthorizePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders access code form', () => {
    render(<AuthorizePage />);
    expect(screen.getByText(/Staff Authorization/i)).toBeInTheDocument();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('shows error for wrong code', async () => {
    mockLogin.mockReturnValue(false);

    render(<AuthorizePage />);
    const inputs = screen.getAllByRole('textbox');
    await userEvent.click(inputs[0]);
    await userEvent.keyboard('000000');
    await userEvent.click(screen.getByText(/Authenticate/i));

    await waitFor(() => {
      expect(screen.getByText(/Invalid code/i)).toBeInTheDocument();
    });
  });

  it('navigates to registration on correct code', async () => {
    mockLogin.mockReturnValue(true);

    render(<AuthorizePage />);
    const inputs = screen.getAllByRole('textbox');
    await userEvent.click(inputs[0]);
    await userEvent.keyboard('260724');
    await userEvent.click(screen.getByText(/Authenticate/i));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/registration');
    });
  });
});
