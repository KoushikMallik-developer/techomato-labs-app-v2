import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import projectsReducer, {
  fetchProjects,
  createProject,
  saveProject,
  removeProject,
  duplicateProject,
  importProject,
  createFolder,
  renameFolder,
  deleteFolder,
  moveToFolder,
  setQuery,
  setSort,
  setFolderFilter,
  setTagFilter,
  nextPage,
  selectProjectsState,
} from './projectsSlice';

vi.mock('@/lib/api', () => ({
  api: {
    projects: vi.fn(),
    folders: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    duplicate: vi.fn(),
    importProject: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
    moveToFolder: vi.fn(),
  },
}));

function makeStore() {
  return configureStore({ reducer: { projects: projectsReducer } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projectsSlice', () => {
  it('fetchProjects.fulfilled loads items and folders together', async () => {
    api.projects.mockResolvedValue([{ id: 'p-1', name: 'A' }]);
    api.folders.mockResolvedValue([{ id: 'f-1', name: 'Folder' }]);
    const store = makeStore();
    await store.dispatch(fetchProjects());
    const state = selectProjectsState(store.getState());
    expect(state.items).toEqual([{ id: 'p-1', name: 'A' }]);
    expect(state.folders).toEqual([{ id: 'f-1', name: 'Folder' }]);
    expect(state.status).toBe('idle');
  });

  it('createProject.fulfilled appends a new project', async () => {
    api.create.mockResolvedValue({ id: 'p-new', name: 'Untitled circuit' });
    const store = makeStore();
    await store.dispatch(createProject({ templateKey: 'blank', name: 'Untitled circuit' }));
    expect(selectProjectsState(store.getState()).items).toEqual([{ id: 'p-new', name: 'Untitled circuit' }]);
  });

  it('saveProject.fulfilled upserts an existing project in place', async () => {
    api.projects.mockResolvedValue([{ id: 'p-1', name: 'Old name' }]);
    api.folders.mockResolvedValue([]);
    api.save.mockResolvedValue({ id: 'p-1', name: 'New name' });
    const store = makeStore();
    await store.dispatch(fetchProjects());
    await store.dispatch(saveProject({ id: 'p-1', patch: { name: 'New name' } }));
    const state = selectProjectsState(store.getState());
    expect(state.items).toHaveLength(1);
    expect(state.items[0].name).toBe('New name');
  });

  it('removeProject.fulfilled drops the project from the list', async () => {
    api.projects.mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }]);
    api.folders.mockResolvedValue([]);
    api.remove.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(fetchProjects());
    await store.dispatch(removeProject('p-1'));
    expect(selectProjectsState(store.getState()).items).toEqual([{ id: 'p-2' }]);
  });

  it('duplicateProject.fulfilled adds the duplicate', async () => {
    api.duplicate.mockResolvedValue({ id: 'p-copy', name: 'Copy of X' });
    const store = makeStore();
    await store.dispatch(duplicateProject('p-1'));
    expect(selectProjectsState(store.getState()).items).toEqual([{ id: 'p-copy', name: 'Copy of X' }]);
  });

  it('importProject parses the JSON string before calling the API', async () => {
    api.importProject.mockResolvedValue({ id: 'p-imported', name: 'Imported circuit' });
    const store = makeStore();
    const json = JSON.stringify({ name: 'Imported circuit', parts: [], wires: [], code: '' });
    await store.dispatch(importProject(json));
    expect(api.importProject).toHaveBeenCalledWith({ name: 'Imported circuit', parts: [], wires: [], code: '' });
    expect(selectProjectsState(store.getState()).items).toEqual([{ id: 'p-imported', name: 'Imported circuit' }]);
  });

  it('createFolder.fulfilled appends the new folder', async () => {
    api.createFolder.mockResolvedValue({ id: 'f-1', name: 'New folder' });
    const store = makeStore();
    await store.dispatch(createFolder('New folder'));
    expect(selectProjectsState(store.getState()).folders).toEqual([{ id: 'f-1', name: 'New folder' }]);
  });

  it('renameFolder.fulfilled updates the folder name from the server response', async () => {
    api.createFolder.mockResolvedValue({ id: 'f-1', name: 'Old' });
    api.renameFolder.mockResolvedValue({ id: 'f-1', name: 'Renamed' });
    const store = makeStore();
    await store.dispatch(createFolder('Old'));
    await store.dispatch(renameFolder({ id: 'f-1', name: 'Renamed' }));
    expect(selectProjectsState(store.getState()).folders[0].name).toBe('Renamed');
  });

  it('deleteFolder.fulfilled removes the folder and clears it from any project', async () => {
    api.projects.mockResolvedValue([{ id: 'p-1', folder: 'f-1' }]);
    api.folders.mockResolvedValue([{ id: 'f-1', name: 'Folder' }]);
    api.deleteFolder.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(fetchProjects());
    await store.dispatch(deleteFolder('f-1'));
    const state = selectProjectsState(store.getState());
    expect(state.folders).toEqual([]);
    expect(state.items[0].folder).toBeNull();
  });

  it('moveToFolder.fulfilled upserts the moved project', async () => {
    api.projects.mockResolvedValue([{ id: 'p-1', folder: null }]);
    api.folders.mockResolvedValue([]);
    api.moveToFolder.mockResolvedValue({ id: 'p-1', folder: 'f-1' });
    const store = makeStore();
    await store.dispatch(fetchProjects());
    await store.dispatch(moveToFolder({ id: 'p-1', folderId: 'f-1' }));
    expect(selectProjectsState(store.getState()).items[0].folder).toBe('f-1');
  });

  it('filter/sort/pagination reducers update their own field and reset the page on filter changes', () => {
    const store = makeStore();
    store.dispatch(nextPage());
    expect(selectProjectsState(store.getState()).page).toBe(2);

    store.dispatch(setQuery('blink'));
    expect(selectProjectsState(store.getState()).query).toBe('blink');
    expect(selectProjectsState(store.getState()).page).toBe(1);

    store.dispatch(nextPage());
    store.dispatch(setFolderFilter('f-1'));
    expect(selectProjectsState(store.getState()).folder).toBe('f-1');
    expect(selectProjectsState(store.getState()).page).toBe(1);

    store.dispatch(nextPage());
    store.dispatch(setTagFilter('beginner'));
    expect(selectProjectsState(store.getState()).tag).toBe('beginner');
    expect(selectProjectsState(store.getState()).page).toBe(1);

    store.dispatch(setSort('name'));
    expect(selectProjectsState(store.getState()).sort).toBe('name');
  });
});
