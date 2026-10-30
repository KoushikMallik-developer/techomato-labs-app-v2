import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, projectsState } from '@/test-utils';
import { api } from '@/lib/api';
import ManageFoldersModal from './ManageFoldersModal';
import { selectModal } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { createFolder: vi.fn(), renameFolder: vi.fn(), deleteFolder: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ManageFoldersModal', () => {
  it('shows a placeholder when there are no folders', () => {
    renderWithProviders(<ManageFoldersModal close={() => {}} />, { preloadedState: { projects: projectsState() } });
    expect(screen.getByText('No folders yet.')).toBeInTheDocument();
  });

  it('lists existing folders', () => {
    renderWithProviders(<ManageFoldersModal close={() => {}} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Sensors' }] }) },
    });
    expect(screen.getByText('Sensors')).toBeInTheDocument();
  });

  it('creates a new folder and clears the input', async () => {
    api.createFolder.mockResolvedValue({ id: 'f-1', name: 'Wiring' });
    renderWithProviders(<ManageFoldersModal close={() => {}} />, { preloadedState: { projects: projectsState() } });
    const input = screen.getByPlaceholderText('New folder name');
    fireEvent.change(input, { target: { value: 'Wiring' } });
    fireEvent.click(screen.getByText('Add'));
    expect(api.createFolder).toHaveBeenCalledWith('Wiring');
    expect(input).toHaveValue('');
  });

  it('does not create a blank-named folder', () => {
    renderWithProviders(<ManageFoldersModal close={() => {}} />, { preloadedState: { projects: projectsState() } });
    fireEvent.click(screen.getByText('Add'));
    expect(api.createFolder).not.toHaveBeenCalled();
  });

  it('renames a folder on blur', async () => {
    api.renameFolder.mockResolvedValue({ id: 'f-1', name: 'Renamed' });
    renderWithProviders(<ManageFoldersModal close={() => {}} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Old' }] }) },
    });
    fireEvent.click(screen.getByText('Rename'));
    const input = screen.getByDisplayValue('Old');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.renameFolder).toHaveBeenCalledWith('f-1', 'Renamed'));
  });

  it('renames a folder on Enter', async () => {
    api.renameFolder.mockResolvedValue({ id: 'f-1', name: 'Renamed' });
    renderWithProviders(<ManageFoldersModal close={() => {}} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Old' }] }) },
    });
    fireEvent.click(screen.getByText('Rename'));
    const input = screen.getByDisplayValue('Old');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.renameFolder).toHaveBeenCalledWith('f-1', 'Renamed'));
  });

  it('opens a confirm dialog before deleting a folder', () => {
    const { store } = renderWithProviders(<ManageFoldersModal close={() => {}} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Sensors' }] }) },
    });
    fireEvent.click(screen.getByText('Delete'));
    const modal = selectModal(store.getState());
    expect(modal.type).toBe('confirm');
    expect(modal.props.title).toBe('Delete "Sensors"?');
  });

  it('confirming delete dispatches deleteFolder', async () => {
    api.deleteFolder.mockResolvedValue(undefined);
    const { store } = renderWithProviders(<ManageFoldersModal close={() => {}} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Sensors' }] }) },
    });
    fireEvent.click(screen.getByText('Delete'));
    const { onConfirm } = selectModal(store.getState()).props;
    await onConfirm();
    expect(api.deleteFolder).toHaveBeenCalledWith('f-1');
  });

  it('calls close() when Done is clicked', () => {
    const close = vi.fn();
    renderWithProviders(<ManageFoldersModal close={close} />, { preloadedState: { projects: projectsState() } });
    fireEvent.click(screen.getByText('Done'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
