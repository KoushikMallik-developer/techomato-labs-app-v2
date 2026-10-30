import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import ProjectMenuModal from './ProjectMenuModal';
import { selectModal, selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { duplicate: vi.fn(), exportProject: vi.fn(), remove: vi.fn() },
}));

const project = { id: 'p-1', name: 'My Circuit!', published: false, approved: false };

beforeEach(() => {
  vi.clearAllMocks();
});

function renderModal(proj = project, close = vi.fn()) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<ProjectMenuModal project={proj} close={close} />} />
      <Route path="/editor/:id" element={<div>Editor page</div>} />
    </Routes>,
  );
}

describe('ProjectMenuModal — navigation actions', () => {
  it('opens the editor and closes', () => {
    const close = vi.fn();
    renderModal(project, close);
    fireEvent.click(screen.getByText('Open in editor'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('opens the rename/move/edit-tags/publish sub-modals with the project', () => {
    const { store } = renderModal();
    fireEvent.click(screen.getByText('Rename'));
    expect(selectModal(store.getState())).toEqual({ type: 'rename-project', props: { project } });

    fireEvent.click(screen.getByText('Move to folder'));
    expect(selectModal(store.getState())).toEqual({ type: 'folder-picker', props: { project } });

    fireEvent.click(screen.getByText('Edit tags'));
    expect(selectModal(store.getState())).toEqual({ type: 'edit-tags', props: { project } });

    fireEvent.click(screen.getByText('Share to Community Circuits'));
    expect(selectModal(store.getState())).toEqual({ type: 'publish', props: { project } });
  });
});

describe('ProjectMenuModal — share button label', () => {
  it('shows "Share to Community Circuits" when never published', () => {
    renderModal({ ...project, published: false, approved: false });
    expect(screen.getByText('Share to Community Circuits')).toBeInTheDocument();
  });

  it('shows "Edit submission (pending approval)" when published but not approved', () => {
    renderModal({ ...project, published: true, approved: false });
    expect(screen.getByText('Edit submission (pending approval)')).toBeInTheDocument();
  });

  it('shows "Edit Community Circuits listing" and a copy-link button once approved', () => {
    renderModal({ ...project, published: true, approved: true });
    expect(screen.getByText('Edit Community Circuits listing')).toBeInTheDocument();
    expect(screen.getByText('Copy Community Circuits link')).toBeInTheDocument();
  });

  it('hides the copy-link button until approved', () => {
    renderModal({ ...project, published: true, approved: false });
    expect(screen.queryByText('Copy Community Circuits link')).not.toBeInTheDocument();
  });
});

describe('ProjectMenuModal — duplicate', () => {
  it('duplicates, shows a toast, and closes', async () => {
    api.duplicate.mockResolvedValue({ id: 'p-2', name: 'Copy of My Circuit!' });
    const close = vi.fn();
    const { store } = renderModal(project, close);
    fireEvent.click(screen.getByText('Duplicate'));
    await waitFor(() => expect(api.duplicate).toHaveBeenCalledWith('p-1'));
    expect(selectToast(store.getState()).message).toBe('Project duplicated.');
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectMenuModal — export', () => {
  let createObjectURL;
  let revokeObjectURL;
  let clickSpy;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it('downloads the exported project as a sanitized filename and closes', async () => {
    api.exportProject.mockResolvedValue({ name: 'My Circuit!', parts: [], wires: [], code: '' });
    const close = vi.fn();
    renderModal(project, close);
    fireEvent.click(screen.getByText('Export JSON'));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectMenuModal — copy link', () => {
  it('copies the community link via the clipboard API and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const close = vi.fn();
    const { store } = renderModal({ ...project, published: true, approved: true }, close);
    fireEvent.click(screen.getByText('Copy Community Circuits link'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/community/p-1`));
    expect(selectToast(store.getState()).message).toBe('Link copied.');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('falls back to window.prompt when the clipboard API rejects', async () => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => {});
    renderModal({ ...project, published: true, approved: true });
    fireEvent.click(screen.getByText('Copy Community Circuits link'));
    await waitFor(() => expect(promptSpy).toHaveBeenCalledWith('Copy this link:', `${window.location.origin}/community/p-1`));
    promptSpy.mockRestore();
  });
});

describe('ProjectMenuModal — delete', () => {
  it('closes this modal and opens a confirm dialog that removes the project', async () => {
    api.remove.mockResolvedValue(undefined);
    const close = vi.fn();
    const { store } = renderModal(project, close);
    fireEvent.click(screen.getByText('Delete'));
    expect(close).not.toHaveBeenCalled();
    await waitFor(() => expect(selectModal(store.getState()).type).toBe('confirm'));
    const { title, onConfirm } = selectModal(store.getState()).props;
    expect(title).toBe('Delete "My Circuit!"?');
    await onConfirm();
    expect(api.remove).toHaveBeenCalledWith('p-1');
  });
});

describe('ProjectMenuModal — close', () => {
  it('calls close() when Close is clicked', () => {
    const close = vi.fn();
    renderModal(project, close);
    fireEvent.click(screen.getByText('Close'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
