import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, editorState } from '@/test-utils';
import { api } from '@/lib/api';
import Hud from './Hud';
import { selectModal, selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { save: vi.fn(), project: vi.fn() },
}));

vi.mock('../engine/audio', () => ({ primeAudio: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const baseProps = {
  name: 'My circuit',
  saveState: 'saved',
  view: '2d',
  running: false,
  projectId: 'p-1',
  onAudioWarn: () => {},
};

function renderHud(props = {}, preloadedState) {
  return renderWithProviders(<Hud {...baseProps} {...props} />, { preloadedState });
}

describe('Hud', () => {
  it('shows the project name and save state', () => {
    renderHud({ saveState: 'dirty' });
    expect(screen.getByLabelText('Project name')).toHaveValue('My circuit');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('shows "Saving…" and "Saved on this device" for the other save states', () => {
    const { rerender } = renderHud({ saveState: 'saving' });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    rerender(<Hud {...baseProps} saveState="saved" />);
    expect(screen.getByText('Saved on this device')).toBeInTheDocument();
  });

  it('renames the project as you type', () => {
    const { store } = renderHud();
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Renamed' } });
    expect(store.getState().editor.name).toBe('Renamed');
  });

  it('toggles between 2D and 3D view', () => {
    const { store } = renderHud({ view: '2d' });
    expect(screen.getByText('2D').className).toContain('on');
    fireEvent.click(screen.getByText('3D'));
    expect(store.getState().editor.view).toBe('3d');
  });

  it('saves and shows a toast', async () => {
    api.save.mockResolvedValue({ id: 'p-1' });
    const { store } = renderHud({}, { editor: editorState({ projectId: 'p-1' }) });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(selectToast(store.getState()).message).toBe('Saved.'));
  });

  it('shares the project by fetching it fresh and opening the publish modal', async () => {
    api.save.mockResolvedValue({ id: 'p-1' });
    api.project.mockResolvedValue({ id: 'p-1', name: 'My circuit', published: false });
    const { store } = renderHud({}, { editor: editorState({ projectId: 'p-1' }) });
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() => expect(selectModal(store.getState()).type).toBe('publish'));
    expect(api.project).toHaveBeenCalledWith('p-1');
  });

  it('does nothing if the project can no longer be found when sharing', async () => {
    api.save.mockResolvedValue({ id: 'p-1' });
    api.project.mockResolvedValue(null);
    const { store } = renderHud({}, { editor: editorState({ projectId: 'p-1' }) });
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() => expect(api.project).toHaveBeenCalled());
    expect(selectModal(store.getState()).type).toBeNull();
  });

  it('opens a confirm dialog on Reset, and reverting shows a toast', async () => {
    api.save.mockResolvedValue({ id: 'p-1' });
    api.project.mockResolvedValue({ id: 'p-1', name: 'My circuit', parts: [], wires: [], code: '' });
    const { store } = renderHud({}, { editor: editorState({ projectId: 'p-1' }) });
    fireEvent.click(screen.getByText('Reset'));
    const modal = selectModal(store.getState());
    expect(modal.type).toBe('confirm');
    await modal.props.onConfirm();
    expect(selectToast(store.getState()).message).toBe('Circuit reset to last save.');
  });

  it('toggles running on and off', () => {
    const { store, rerender } = renderHud({ running: false });
    expect(screen.getByText('▶ Run')).toBeInTheDocument();
    fireEvent.click(screen.getByText('▶ Run'));
    expect(store.getState().editor.running).toBe(true);

    rerender(<Hud {...baseProps} running />);
    expect(screen.getByText('■ Stop')).toBeInTheDocument();
  });

  it('links back to /projects', () => {
    renderHud();
    expect(screen.getByLabelText('Back to your projects')).toHaveAttribute('href', '/projects');
  });
});
