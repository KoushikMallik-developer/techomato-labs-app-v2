import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import AdminPanelPage from './AdminPanelPage';

vi.mock('@/lib/api', () => ({
  api: { pendingCircuits: vi.fn(), approveCircuit: vi.fn(), rejectCircuit: vi.fn(), adminLogout: vi.fn() },
}));

const pendingItem = {
  id: 'p-1',
  name: 'Garage Sensor',
  author: 'hana_builds',
  parts: [],
  wires: [],
  tags: ['sensors'],
  description: 'An ultrasonic sensor project.',
  publishedAt: Date.now() - 3600_000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminPanelPage', () => {
  it('shows an empty state when nothing is pending', async () => {
    api.pendingCircuits.mockResolvedValue([]);
    renderWithProviders(<AdminPanelPage />);
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
  });

  it('lists pending submissions with their details', async () => {
    api.pendingCircuits.mockResolvedValue([pendingItem]);
    renderWithProviders(<AdminPanelPage />);
    expect(await screen.findByText('Garage Sensor')).toBeInTheDocument();
    expect(screen.getByText(/by @hana_builds/)).toBeInTheDocument();
    expect(screen.getByText('An ultrasonic sensor project.')).toBeInTheDocument();
    expect(screen.getByText('sensors')).toBeInTheDocument();
  });

  it('approves an item and removes it from the list', async () => {
    api.pendingCircuits.mockResolvedValueOnce([pendingItem]).mockResolvedValueOnce([]);
    api.approveCircuit.mockResolvedValue(undefined);
    renderWithProviders(<AdminPanelPage />);
    await screen.findByText('Garage Sensor');
    fireEvent.click(screen.getByText('Approve'));
    expect(api.approveCircuit).toHaveBeenCalledWith('p-1');
    await waitFor(() => expect(screen.queryByText('Garage Sensor')).not.toBeInTheDocument());
    expect(screen.getByText('Nothing to review')).toBeInTheDocument();
  });

  it('rejects an item and removes it from the list', async () => {
    api.pendingCircuits.mockResolvedValueOnce([pendingItem]).mockResolvedValueOnce([]);
    api.rejectCircuit.mockResolvedValue(undefined);
    renderWithProviders(<AdminPanelPage />);
    await screen.findByText('Garage Sensor');
    fireEvent.click(screen.getByText('Reject'));
    expect(api.rejectCircuit).toHaveBeenCalledWith('p-1');
    await waitFor(() => expect(screen.queryByText('Garage Sensor')).not.toBeInTheDocument());
  });

  it('logs out via the Log out button', async () => {
    api.pendingCircuits.mockResolvedValue([]);
    api.adminLogout.mockResolvedValue(undefined);
    renderWithProviders(<AdminPanelPage />);
    await screen.findByText('Nothing to review');
    fireEvent.click(screen.getByText('Log out'));
    await waitFor(() => expect(api.adminLogout).toHaveBeenCalledTimes(1));
  });
});
