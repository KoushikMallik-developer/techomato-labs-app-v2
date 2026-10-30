import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, projectsState } from '@/test-utils';
import { api } from '@/lib/api';
import FolderPickerModal from './FolderPickerModal';

vi.mock('@/lib/api', () => ({
  api: { moveToFolder: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FolderPickerModal', () => {
  it('lists "No folder" plus every existing folder', () => {
    renderWithProviders(<FolderPickerModal project={{ id: 'p-1' }} close={() => {}} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Sensors' }] }) },
    });
    expect(screen.getByText('No folder')).toBeInTheDocument();
    expect(screen.getByText('Sensors')).toBeInTheDocument();
  });

  it('moves the project to the chosen folder and closes', async () => {
    api.moveToFolder.mockResolvedValue({ id: 'p-1', folder: 'f-1' });
    const close = vi.fn();
    renderWithProviders(<FolderPickerModal project={{ id: 'p-1' }} close={close} />, {
      preloadedState: { projects: projectsState({ folders: [{ id: 'f-1', name: 'Sensors' }] }) },
    });
    fireEvent.click(screen.getByText('Sensors'));
    expect(close).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.moveToFolder).toHaveBeenCalledWith('p-1', 'f-1'));
  });

  it('moving to "No folder" passes null', async () => {
    api.moveToFolder.mockResolvedValue({ id: 'p-1', folder: null });
    renderWithProviders(<FolderPickerModal project={{ id: 'p-1' }} close={() => {}} />, {
      preloadedState: { projects: projectsState() },
    });
    fireEvent.click(screen.getByText('No folder'));
    await waitFor(() => expect(api.moveToFolder).toHaveBeenCalledWith('p-1', null));
  });

  it('calls close() on Cancel without moving', () => {
    const close = vi.fn();
    renderWithProviders(<FolderPickerModal project={{ id: 'p-1' }} close={close} />, {
      preloadedState: { projects: projectsState() },
    });
    fireEvent.click(screen.getByText('Cancel'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(api.moveToFolder).not.toHaveBeenCalled();
  });
});
