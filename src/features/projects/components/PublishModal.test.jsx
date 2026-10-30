import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import PublishModal from './PublishModal';
import { selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { publish: vi.fn(), unpublish: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublishModal — never published', () => {
  const project = { id: 'p-1', name: 'My circuit', published: false, approved: false, description: '', tags: [] };

  it('shows the "share" framing and no unpublish button', () => {
    renderWithProviders(<PublishModal project={project} close={() => {}} />);
    expect(screen.getByText('Share to Community Circuits')).toBeInTheDocument();
    expect(screen.queryByText(/Remove from Community Circuits|Cancel submission/)).not.toBeInTheDocument();
    expect(screen.getByText('Submit for approval')).toBeInTheDocument();
  });

  it('submits the description and selected tags', async () => {
    api.publish.mockResolvedValue({ ...project, published: true });
    const close = vi.fn();
    const { store } = renderWithProviders(<PublishModal project={project} close={close} />);
    fireEvent.change(screen.getByPlaceholderText('What does this circuit do?'), { target: { value: 'Blinks.' } });
    fireEvent.click(screen.getByText('beginner'));
    fireEvent.click(screen.getByText('Submit for approval'));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith('p-1', { description: 'Blinks.', tags: ['beginner'] }));
    expect(selectToast(store.getState()).message).toBe('Submitted for admin approval.');
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('PublishModal — published, pending approval', () => {
  const project = { id: 'p-1', name: 'My circuit', published: true, approved: false, description: '', tags: [] };

  it('shows the pending-approval notice and a resubmit label', () => {
    renderWithProviders(<PublishModal project={project} close={() => {}} />);
    expect(screen.getByText('Awaiting admin approval — not public yet.')).toBeInTheDocument();
    expect(screen.getByText('Resubmit for approval')).toBeInTheDocument();
    expect(screen.getByText('Cancel submission')).toBeInTheDocument();
  });

  it('cancelling the submission unpublishes and shows a toast', async () => {
    api.unpublish.mockResolvedValue({ ...project, published: false });
    const { store } = renderWithProviders(<PublishModal project={project} close={() => {}} />);
    fireEvent.click(screen.getByText('Cancel submission'));
    await waitFor(() => expect(api.unpublish).toHaveBeenCalledWith('p-1'));
    expect(selectToast(store.getState()).message).toBe('Removed from Community Circuits.');
  });
});

describe('PublishModal — published and approved', () => {
  const project = { id: 'p-1', name: 'My circuit', published: true, approved: true, description: 'desc', tags: ['beginner'] };

  it('shows no pending notice and a "remove" label', () => {
    renderWithProviders(<PublishModal project={project} close={() => {}} />);
    expect(screen.queryByText('Awaiting admin approval — not public yet.')).not.toBeInTheDocument();
    expect(screen.getByText('Remove from Community Circuits')).toBeInTheDocument();
  });

  it('pre-fills the existing description and tags', () => {
    renderWithProviders(<PublishModal project={project} close={() => {}} />);
    expect(screen.getByPlaceholderText('What does this circuit do?')).toHaveValue('desc');
    expect(screen.getByText('beginner').className).toContain('on');
  });
});

describe('PublishModal — close', () => {
  it('calls close() on Cancel', () => {
    const close = vi.fn();
    renderWithProviders(
      <PublishModal project={{ id: 'p-1', name: 'x', published: false, approved: false, tags: [] }} close={close} />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
