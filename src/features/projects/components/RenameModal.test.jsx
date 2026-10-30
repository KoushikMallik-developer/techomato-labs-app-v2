import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import RenameModal from './RenameModal';

vi.mock('@/lib/api', () => ({
  api: { save: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const project = { id: 'p-1', name: 'My first circuit' };

describe('RenameModal', () => {
  it('pre-fills the current name', () => {
    renderWithProviders(<RenameModal project={project} close={() => {}} />);
    expect(screen.getByLabelText('Name')).toHaveValue('My first circuit');
  });

  it('saves the trimmed new name and closes', async () => {
    api.save.mockResolvedValue({ ...project, name: 'Renamed circuit' });
    const close = vi.fn();
    renderWithProviders(<RenameModal project={project} close={close} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Renamed circuit  ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(close).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.save).toHaveBeenCalledWith('p-1', { name: 'Renamed circuit' }));
  });

  it('does not write when the name is unchanged (a save would send a live circuit back to review)', () => {
    const close = vi.fn();
    renderWithProviders(<RenameModal project={project} close={close} />);
    fireEvent.click(screen.getByText('Save'));
    expect(api.save).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('warns that renaming a live circuit sends it back for review', () => {
    renderWithProviders(<RenameModal project={{ ...project, approved: true }} close={() => {}} />);
    expect(screen.getByText(/sends it back for review/)).toBeInTheDocument();
  });

  it('does not save a blank name, but still closes', () => {
    const close = vi.fn();
    renderWithProviders(<RenameModal project={project} close={close} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(api.save).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('calls close() on Cancel without saving', () => {
    const close = vi.fn();
    renderWithProviders(<RenameModal project={project} close={close} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });
});
