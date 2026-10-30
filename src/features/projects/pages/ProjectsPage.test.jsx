import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, projectsState } from '@/test-utils';
import { api } from '@/lib/api';
import ProjectsPage from './ProjectsPage';
import { selectModal, selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { projects: vi.fn(), folders: vi.fn(), importProject: vi.fn() },
}));

function project(id, name, overrides = {}) {
  return { id, name, parts: [], wires: [], tags: [], folder: null, updatedAt: Date.now(), createdAt: Date.now(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.projects.mockResolvedValue([]);
  api.folders.mockResolvedValue([]);
});

describe('ProjectsPage', () => {
  it('shows a loading state before projects arrive', () => {
    api.projects.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ProjectsPage />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('lists fetched projects', async () => {
    api.projects.mockResolvedValue([project('p-1', 'Blink'), project('p-2', 'Traffic light')]);
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText('Blink')).toBeInTheDocument();
    expect(screen.getByText('Traffic light')).toBeInTheDocument();
  });

  it('filters by name as you type', async () => {
    api.projects.mockResolvedValue([project('p-1', 'Blink'), project('p-2', 'Traffic light')]);
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Blink');
    fireEvent.change(screen.getByPlaceholderText('Search projects…'), { target: { value: 'traffic' } });
    expect(screen.queryByText('Blink')).not.toBeInTheDocument();
    expect(screen.getByText('Traffic light')).toBeInTheDocument();
  });

  it('shows folder chips and filters by folder', async () => {
    api.projects.mockResolvedValue([project('p-1', 'In folder', { folder: 'f-1' }), project('p-2', 'No folder')]);
    api.folders.mockResolvedValue([{ id: 'f-1', name: 'Sensors' }]);
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('In folder');
    fireEvent.click(screen.getByText('Sensors'));
    expect(screen.getByText('In folder')).toBeInTheDocument();
    expect(screen.queryByText('No folder', { selector: '.pname' })).not.toBeInTheDocument();
  });

  it('shows tag chips only when projects have tags, and filters by tag', async () => {
    api.projects.mockResolvedValue([project('p-1', 'Tagged', { tags: ['beginner'] }), project('p-2', 'Untagged')]);
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Tagged');
    expect(screen.getByText('All tags')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'beginner' }));
    expect(screen.getByText('Tagged')).toBeInTheDocument();
    expect(screen.queryByText('Untagged')).not.toBeInTheDocument();
  });

  it('hides the tag row entirely when no project has tags', async () => {
    api.projects.mockResolvedValue([project('p-1', 'Plain')]);
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Plain');
    expect(screen.queryByText('All tags')).not.toBeInTheDocument();
  });

  it('paginates with a Load more button', async () => {
    const many = Array.from({ length: 10 }, (_, i) => project(`p-${i}`, `Project ${i}`));
    api.projects.mockResolvedValue(many);
    renderWithProviders(<ProjectsPage />);
    await screen.findByText('Project 0');
    expect(screen.queryByText('Project 9')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Load more'));
    expect(screen.getByText('Project 9')).toBeInTheDocument();
  });

  it('opens the new-project modal', async () => {
    api.projects.mockResolvedValue([project('p-1', 'Blink')]);
    const { store } = renderWithProviders(<ProjectsPage />);
    await screen.findByText('Blink');
    fireEvent.click(screen.getByText('New project'));
    expect(selectModal(store.getState()).type).toBe('new-project');
  });

  it('opens the manage-folders modal', async () => {
    const { store } = renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(api.projects).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Manage folders…'));
    expect(selectModal(store.getState()).type).toBe('manage-folders');
  });

  it('imports a valid project file and shows a success toast', async () => {
    api.importProject.mockResolvedValue({ id: 'p-imported', name: 'Imported' });
    const { store, container } = renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(api.projects).toHaveBeenCalled());
    const file = new File([JSON.stringify({ name: 'Imported', parts: [], wires: [], code: '' })], 'circuit.json', {
      type: 'application/json',
    });
    const input = container.querySelector('input[type=file]');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(selectToast(store.getState()).message).toBe('Project imported.'));
  });

  it('shows an error toast when the imported file is not valid JSON', async () => {
    const { store, container } = renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(api.projects).toHaveBeenCalled());
    const file = new File(['not json'], 'circuit.json', { type: 'application/json' });
    const input = container.querySelector('input[type=file]');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(selectToast(store.getState()).message).toBe('That file could not be imported.'));
  });
});
