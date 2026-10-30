import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import { selectModal } from '@/features/ui/uiSlice';
import ReportsSection from './ReportsSection';

vi.mock('@/lib/api', () => ({
  api: {
    adminReports: vi.fn(),
    dismissReport: vi.fn(),
    rejectCircuit: vi.fn(),
    deleteThread: vi.fn(),
    pendingCircuits: vi.fn(async () => []),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const reports = [
  { id: 'p1_u1', projectId: 'p1', reason: 'Spam', createdAt: 2 },
  { id: 'p1_u2', projectId: 'p1', reason: 'Copied', createdAt: 1 },
  { id: 'p2_u1', projectId: 'p2', reason: 'Broken', createdAt: 1 },
];

describe('ReportsSection', () => {
  it('dismisses one report', async () => {
    api.adminReports.mockResolvedValue(reports);
    api.dismissReport.mockResolvedValue('p2_u1');
    renderWithProviders(<ReportsSection />);
    expect(await screen.findByText('Broken')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Dismiss')[2]);
    await waitFor(() => expect(screen.queryByText('Broken')).not.toBeInTheDocument());
    expect(api.dismissReport).toHaveBeenCalledWith('p2_u1');
  });

  it('closes the reports when the circuit was already unshared', async () => {
    api.adminReports.mockResolvedValue(reports);
    api.rejectCircuit.mockRejectedValue(new Error('denied'));
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = renderWithProviders(<ReportsSection />);
    fireEvent.click((await screen.findAllByText('Take down'))[0]);
    await selectModal(store.getState()).props.onConfirm();
    await waitFor(() => expect(screen.queryByText('Spam')).not.toBeInTheDocument());
    expect(api.dismissReport).toHaveBeenCalledTimes(2);
  });

  it('deletes the discussion behind a thread report', async () => {
    api.adminReports.mockResolvedValue([{ id: 'thread:t9_u1', projectId: 'thread:t9', reason: 'Spam link', createdAt: 1 }]);
    api.deleteThread.mockResolvedValue();
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = renderWithProviders(<ReportsSection />);
    expect((await screen.findByText('Open discussion')).closest('a')).toHaveAttribute('href', '/discussions/t9');
    fireEvent.click(screen.getByText('Take down'));
    await selectModal(store.getState()).props.onConfirm();
    expect(api.deleteThread).toHaveBeenCalledWith('t9');
    expect(api.rejectCircuit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Spam link')).not.toBeInTheDocument());
  });

  it('asks before taking a circuit down, then clears every report about it', async () => {
    api.adminReports.mockResolvedValue(reports);
    api.rejectCircuit.mockResolvedValue();
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = renderWithProviders(<ReportsSection />);
    fireEvent.click((await screen.findAllByText('Take down'))[0]);
    expect(api.rejectCircuit).not.toHaveBeenCalled();
    await selectModal(store.getState()).props.onConfirm();
    expect(api.rejectCircuit).toHaveBeenCalledWith('p1');
    expect(api.dismissReport.mock.calls.map((c) => c[0])).toEqual(['p1_u1', 'p1_u2']);
    await waitFor(() => expect(screen.queryByText('Spam')).not.toBeInTheDocument());
    expect(screen.getByText('Broken')).toBeInTheDocument();
  });
});
