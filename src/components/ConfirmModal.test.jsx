import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders defaults when no props are given', () => {
    render(<ConfirmModal close={() => {}} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders custom title, body, and confirm label', () => {
    render(<ConfirmModal title="Delete project?" body="This cannot be undone." confirmLabel="Delete project" close={() => {}} />);
    expect(screen.getByText('Delete project?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Delete project')).toBeInTheDocument();
  });

  it('omits the body paragraph when none is given', () => {
    render(<ConfirmModal close={() => {}} />);
    expect(screen.queryByText('This cannot be undone.')).not.toBeInTheDocument();
  });

  it('applies the danger class by default, or primary when danger=false', () => {
    const { rerender } = render(<ConfirmModal close={() => {}} />);
    expect(screen.getByText('Delete').className).toContain('danger');
    rerender(<ConfirmModal danger={false} confirmLabel="Continue" close={() => {}} />);
    expect(screen.getByText('Continue').className).toContain('primary');
  });

  it('close() is called when Cancel is clicked', () => {
    const close = vi.fn();
    render(<ConfirmModal close={close} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm, shows a busy state, then closes', async () => {
    let resolveConfirm;
    const onConfirm = vi.fn(() => new Promise((res) => { resolveConfirm = res; }));
    const close = vi.fn();
    render(<ConfirmModal confirmLabel="Delete project" onConfirm={onConfirm} close={close} />);

    fireEvent.click(screen.getByText('Delete project'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Working…')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();

    resolveConfirm();
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it('still closes if onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('nope'));
    const close = vi.fn();
    render(<ConfirmModal onConfirm={onConfirm} close={close} />);
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it('closes immediately when there is no onConfirm handler', async () => {
    const close = vi.fn();
    render(<ConfirmModal close={close} />);
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
});
