import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import { selectModal } from '@/features/ui/uiSlice';
import ReportsSection from './ReportsSection';
import { fetchReports } from '../adminSlice';

async function show(list) {
  api.adminReports.mockResolvedValue(list);
  const view = renderWithProviders(<ReportsSection />);
  await view.store.dispatch(fetchReports());
  return view;
}

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
  it('brings in an older report when one is dismissed at the cap', async () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}_u`, projectId: `p${i}`, reason: `r${i}`, createdAt: 100 - i }));
    api.dismissReport.mockResolvedValue('p0_u');
    await show(full);
    api.adminReports.mockResolvedValue([...full.slice(1), { id: 'old_u', projectId: 'old', reason: 'older one', createdAt: 1 }]);
    fireEvent.click(screen.getAllByText('Dismiss')[0]);
    expect(await screen.findByText('older one')).toBeInTheDocument();
    expect(screen.getByText(/Showing the newest 50 reports/)).toBeInTheDocument();
  });

  it('removes the reports that were closed even when another delete fails', async () => {
    api.dismissReport.mockImplementation(async (id) => {
      if (id === 'p1_u2') throw new Error('denied');
      return id;
    });
    const { store } = await show(reports);
    fireEvent.click(screen.getAllByText('Take down')[0]); // p1: reports p1_u1 and p1_u2
    await selectModal(store.getState()).props.onConfirm();
    await waitFor(() => expect(screen.queryByText('Spam')).not.toBeInTheDocument()); // p1_u1 closed
    expect(screen.getByText('Copied')).toBeInTheDocument(); // p1_u2 failed, so it stays
    expect(store.getState().ui.toast.message).toMatch(/could not be closed/);
  });

  it('reloads the list once, not once per report, when a whole group is taken down at the cap', async () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ id: `p_u${i}`, projectId: 'p', reason: `r${i}`, createdAt: 100 - i }));
    api.rejectCircuit.mockResolvedValue();
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = await show(full);
    api.adminReports.mockClear();
    api.adminReports.mockResolvedValue([]);
    fireEvent.click(screen.getByText('Take down'));
    await selectModal(store.getState()).props.onConfirm();
    expect(api.dismissReport).toHaveBeenCalledTimes(50);
    expect(api.adminReports).toHaveBeenCalledTimes(1);
  });

  it('says when only the newest reports are shown', async () => {
    await show(Array.from({ length: 50 }, (_, i) => ({ id: `p_u${i}`, projectId: `p${i}`, reason: 'x', createdAt: i })));
    expect(screen.getByText(/Showing the newest 50 reports/)).toBeInTheDocument();
  });

  it('groups reports by target and shows the count', async () => {
    await show(reports);
    expect(screen.getByText('2 reports')).toBeInTheDocument();
    expect(screen.getByText('1 report')).toBeInTheDocument();
    expect(screen.getAllByText('Take down')).toHaveLength(2);
  });

  it('dismisses one report', async () => {
    api.dismissReport.mockResolvedValue('p2_u1');
    await show(reports);
    expect(await screen.findByText('Broken')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Dismiss')[2]);
    await waitFor(() => expect(screen.queryByText('Broken')).not.toBeInTheDocument());
    expect(api.dismissReport).toHaveBeenCalledWith('p2_u1');
  });

  it('closes the reports when the circuit was already unshared', async () => {
    api.rejectCircuit.mockRejectedValue(new Error('denied'));
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = await show(reports);
    fireEvent.click((await screen.findAllByText('Take down'))[0]);
    await selectModal(store.getState()).props.onConfirm();
    await waitFor(() => expect(screen.queryByText('Spam')).not.toBeInTheDocument());
    expect(api.dismissReport).toHaveBeenCalledTimes(2);
  });

  it('deletes the discussion behind a thread report', async () => {
    api.deleteThread.mockResolvedValue();
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = await show([
      { id: 'thread:t9_u1', projectId: 'thread:t9', reason: 'Spam link', createdAt: 1 },
    ]);
    expect((await screen.findByText('Open discussion')).closest('a')).toHaveAttribute(
      'href',
      '/discussions/t9',
    );
    fireEvent.click(screen.getByText('Take down'));
    await selectModal(store.getState()).props.onConfirm();
    expect(api.deleteThread).toHaveBeenCalledWith('t9');
    expect(api.rejectCircuit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Spam link')).not.toBeInTheDocument());
  });

  it('asks before taking a circuit down, then clears every report about it', async () => {
    api.rejectCircuit.mockResolvedValue();
    api.dismissReport.mockImplementation(async (id) => id);
    const { store } = await show(reports);
    fireEvent.click((await screen.findAllByText('Take down'))[0]);
    expect(api.rejectCircuit).not.toHaveBeenCalled();
    await selectModal(store.getState()).props.onConfirm();
    expect(api.rejectCircuit).toHaveBeenCalledWith('p1');
    expect(api.dismissReport.mock.calls.map((c) => c[0])).toEqual(['p1_u1', 'p1_u2']);
    await waitFor(() => expect(screen.queryByText('Spam')).not.toBeInTheDocument());
    expect(screen.getByText('Broken')).toBeInTheDocument();
  });
});
