import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { selectModal } from '@/features/ui/uiSlice';
import { api } from '@/lib/api';
import AdminPanelPage from './AdminPanelPage';

vi.mock('@/lib/api', () => ({
  api: {
    pendingCircuits: vi.fn(),
    approveCircuit: vi.fn(),
    rejectCircuit: vi.fn(),
    adminLogout: vi.fn(),
    adminUsers: vi.fn(),
    setUserDisabled: vi.fn(),
  },
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
  updatedAt: 777,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.pendingCircuits.mockResolvedValue([]);
  api.adminUsers.mockResolvedValue({ users: [], cursor: null });
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
    expect(api.approveCircuit).toHaveBeenCalledWith('p-1', 777);
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

  const ada = { id: 'u1', name: 'Ada', handle: 'ada', email: 'ada@example.com', createdAt: 1, circuits: 3, community: 2, disabled: false };
  const bob = { id: 'u2', name: 'Bob', handle: 'bob', email: 'bob@example.com', createdAt: 2, circuits: 1, community: 0, disabled: true };

  it('lists users with email and circuit counts, asks before disabling one, and can enable a disabled one', async () => {
    api.adminUsers.mockResolvedValue({ users: [ada, bob], cursor: null });
    api.setUserDisabled.mockImplementation(async (id, disabled) => ({ id, disabled }));
    const { store } = renderWithProviders(<AdminPanelPage />);
    expect(await screen.findByText('@ada')).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/3 circuits/)).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Disable'));
    expect(api.setUserDisabled).not.toHaveBeenCalled(); // it asks first
    expect(selectModal(store.getState()).type).toBe('confirm');
    await selectModal(store.getState()).props.onConfirm();
    expect(api.setUserDisabled).toHaveBeenCalledWith('u1', true);

    // Ada is now disabled too; Bob's button is the second "Enable".
    await waitFor(() => expect(screen.getAllByText('Enable')).toHaveLength(2));
    fireEvent.click(screen.getAllByText('Enable')[1]);
    await waitFor(() => expect(api.setUserDisabled).toHaveBeenCalledWith('u2', false));
  });

  it('opens the community circuits of a user when their count is clicked', async () => {
    api.adminUsers.mockResolvedValue({ users: [ada, bob], cursor: null });
    const { store } = renderWithProviders(<AdminPanelPage />);
    fireEvent.click(await screen.findByText('2 in Community'));
    expect(selectModal(store.getState())).toMatchObject({ type: 'user-circuits', props: { user: { id: 'u1' } } });
    expect(screen.getByText('0 in Community')).toBeInTheDocument(); // nothing to open for Bob
  });

  it('searches users on the server by name, email or handle', async () => {
    api.adminUsers.mockResolvedValue({ users: [ada], cursor: null });
    renderWithProviders(<AdminPanelPage />);
    await screen.findByText('@ada');
    fireEvent.change(screen.getByPlaceholderText('Search by name, email or handle…'), { target: { value: ' Bo ' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(api.adminUsers).toHaveBeenLastCalledWith({ q: 'Bo', after: undefined }));
  });

  it('loads the next page of users', async () => {
    api.adminUsers.mockResolvedValueOnce({ users: [ada], cursor: 100 });
    api.adminUsers.mockResolvedValueOnce({ users: [bob], cursor: null });
    renderWithProviders(<AdminPanelPage />);
    fireEvent.click(await screen.findByText('Load more'));
    expect(await screen.findByText('@bob')).toBeInTheDocument();
    expect(api.adminUsers).toHaveBeenLastCalledWith({ q: '', after: 100 });
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });
});
