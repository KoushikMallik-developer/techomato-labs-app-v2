import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { selectModal } from '@/features/ui/uiSlice';
import { api } from '@/lib/api';
import AdminPanelPage from './AdminPanelPage';

const at = (tab) => renderWithProviders(<AdminPanelPage />, { route: `/admin?tab=${tab}` });

vi.mock('@/lib/api', () => ({
  api: {
    pendingCircuits: vi.fn(),
    approveCircuit: vi.fn(),
    rejectCircuit: vi.fn(),
    adminLogout: vi.fn(),
    adminUsers: vi.fn(),
    setUserDisabled: vi.fn(),
    adminReports: vi.fn(),
    dismissReport: vi.fn(),
    adminActivity: vi.fn(),
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
  api.adminReports.mockResolvedValue([]);
  api.adminActivity.mockResolvedValue({
    edges: [0, 1, 2],
    users: [1, 2],
    circuits: [0, 0],
    posts: [3, 0],
    caps: { users: 100, circuits: 100, posts: 50 },
  });
});

describe('AdminPanelPage', () => {
  it('shows an empty state when nothing is pending', async () => {
    api.pendingCircuits.mockResolvedValue([]);
    at('review');
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
  });

  it('lists pending submissions with their details', async () => {
    api.pendingCircuits.mockResolvedValue([pendingItem]);
    at('review');
    expect(await screen.findByText('Garage Sensor')).toBeInTheDocument();
    expect(screen.getByText(/by @hana_builds/)).toBeInTheDocument();
    expect(screen.getByText('An ultrasonic sensor project.')).toBeInTheDocument();
    expect(screen.getByText('sensors')).toBeInTheDocument();
  });

  it('approves an item and removes it from the list', async () => {
    api.pendingCircuits.mockResolvedValueOnce([pendingItem]).mockResolvedValueOnce([]);
    api.approveCircuit.mockResolvedValue(undefined);
    at('review');
    await screen.findByText('Garage Sensor');
    fireEvent.click(screen.getByText('Approve'));
    expect(api.approveCircuit).toHaveBeenCalledWith('p-1', 777);
    await waitFor(() => expect(screen.queryByText('Garage Sensor')).not.toBeInTheDocument());
    expect(screen.getByText('Nothing to review')).toBeInTheDocument();
  });

  it('rejects an item and removes it from the list', async () => {
    api.pendingCircuits.mockResolvedValueOnce([pendingItem]).mockResolvedValueOnce([]);
    api.rejectCircuit.mockResolvedValue(undefined);
    at('review');
    await screen.findByText('Garage Sensor');
    fireEvent.click(screen.getByText('Reject'));
    expect(api.rejectCircuit).toHaveBeenCalledWith('p-1');
    await waitFor(() => expect(screen.queryByText('Garage Sensor')).not.toBeInTheDocument());
  });

  it('opens on the overview with counts, and the nav switches sections', async () => {
    api.pendingCircuits.mockResolvedValue([pendingItem]);
    api.adminReports.mockResolvedValue([
      { id: 'p-1_u1', projectId: 'p-1', reason: 'Spam', createdAt: 1 },
    ]);
    renderWithProviders(<AdminPanelPage />, { route: '/admin' });
    expect(await screen.findByText('awaiting review')).toBeInTheDocument();
    expect(await screen.findByText(/Garage Sensor by @hana_builds/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reports/ }));
    expect(await screen.findByText('Open circuit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reports/ })).toHaveAttribute('aria-current', 'page');
  });

  it('logs out via the Log out button', async () => {
    api.pendingCircuits.mockResolvedValue([]);
    api.adminLogout.mockResolvedValue(undefined);
    at('review');
    await screen.findByText('Nothing to review');
    fireEvent.click(screen.getByText('Log out'));
    await waitFor(() => expect(api.adminLogout).toHaveBeenCalledTimes(1));
  });

  const ada = {
    id: 'u1',
    name: 'Ada',
    handle: 'ada',
    email: 'ada@example.com',
    createdAt: 1,
    circuits: 3,
    community: 2,
    disabled: false,
  };
  const bob = {
    id: 'u2',
    name: 'Bob',
    handle: 'bob',
    email: 'bob@example.com',
    createdAt: 2,
    circuits: 1,
    community: 0,
    disabled: true,
  };

  it('lists users with email and circuit counts, asks before disabling one, and can enable a disabled one', async () => {
    api.adminUsers.mockResolvedValue({ users: [ada, bob], cursor: null });
    api.setUserDisabled.mockImplementation(async (id, disabled) => ({ id, disabled }));
    const { store } = at('users');
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
    const { store } = at('users');
    fireEvent.click(await screen.findByText('2 in Community'));
    expect(selectModal(store.getState())).toMatchObject({
      type: 'user-circuits',
      props: { user: { id: 'u1' } },
    });
    expect(screen.getByText('0 in Community')).toBeInTheDocument(); // nothing to open for Bob
  });

  it('searches users on the server by name, email or handle', async () => {
    api.adminUsers.mockResolvedValue({ users: [ada], cursor: null });
    at('users');
    await screen.findByText('@ada');
    fireEvent.change(screen.getByPlaceholderText('Search by name, email or handle…'), {
      target: { value: ' Bo ' },
    });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() =>
      expect(api.adminUsers).toHaveBeenLastCalledWith({ q: 'Bo', after: undefined }),
    );
  });

  it('loads the next page of users', async () => {
    api.adminUsers.mockResolvedValueOnce({ users: [ada], cursor: 100 });
    api.adminUsers.mockResolvedValueOnce({ users: [bob], cursor: null });
    at('users');
    fireEvent.click(await screen.findByText('Load more'));
    expect(await screen.findByText('@bob')).toBeInTheDocument();
    expect(api.adminUsers).toHaveBeenLastCalledWith({ q: '', after: 100 });
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });
});
