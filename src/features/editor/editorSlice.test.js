import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import editorReducer, {
  loadProject,
  flushSave,
  revertToSaved,
  reset,
  renameProject,
  addPart,
  movePart,
  rotatePart,
  setPartProp,
  deletePart,
  addWire,
  deleteWire,
  setSelection,
  setPending,
  clearInteraction,
  setCode,
  loadExampleCode,
  setView,
  setRunning,
  toggleSheetCollapsed,
  setActiveTab,
  selectEditor,
} from './editorSlice';

vi.mock('@/lib/api', () => ({
  api: { project: vi.fn(), save: vi.fn() },
}));

function makeStore(preloadedState) {
  return configureStore({ reducer: { editor: editorReducer }, preloadedState: preloadedState && { editor: preloadedState } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('editorSlice thunks', () => {
  it('loadProject.fulfilled populates the document and resets transient state', async () => {
    api.project.mockResolvedValue({ id: 'p-1', name: 'Blink', parts: [{ id: 'led-1' }], wires: [], code: 'x' });
    const store = makeStore();
    await store.dispatch(loadProject('p-1'));
    const s = selectEditor(store.getState());
    expect(s.status).toBe('ready');
    expect(s.projectId).toBe('p-1');
    expect(s.name).toBe('Blink');
    expect(s.saveState).toBe('saved');
    expect(s.running).toBe(false);
  });

  it('loadProject.rejected sets an error status', async () => {
    api.project.mockResolvedValue(null);
    const store = makeStore();
    await store.dispatch(loadProject('missing'));
    const s = selectEditor(store.getState());
    expect(s.status).toBe('error');
    expect(s.error).toBe('Project not found.');
  });

  it('flushSave saves the current doc and marks it saved', async () => {
    api.save.mockResolvedValue({ id: 'p-1' });
    const store = makeStore({
      projectId: 'p-1',
      name: 'x',
      parts: [],
      wires: [],
      code: '',
      saveState: 'dirty',
      selection: null,
      pending: null,
      view: '2d',
      running: false,
      sheetCollapsed: false,
      activeTab: 'code',
      status: 'ready',
      error: null,
    });
    await store.dispatch(flushSave());
    expect(api.save).toHaveBeenCalledWith('p-1', { name: 'x', parts: [], wires: [], code: '' });
    expect(selectEditor(store.getState()).saveState).toBe('saved');
  });

  it('flushSave is a no-op with nothing to save when there is no projectId', async () => {
    const store = makeStore();
    const res = await store.dispatch(flushSave());
    expect(res.payload).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('revertToSaved restores name/parts/wires/code from the server', async () => {
    api.project.mockResolvedValue({ id: 'p-1', name: 'Reverted', parts: [{ id: 'x' }], wires: [], code: 'reverted' });
    const store = makeStore({
      projectId: 'p-1',
      name: 'Dirty name',
      parts: [],
      wires: [],
      code: 'dirty',
      saveState: 'dirty',
      selection: { kind: 'part', id: 'x' },
      pending: null,
      view: '2d',
      running: true,
      sheetCollapsed: false,
      activeTab: 'code',
      status: 'ready',
      error: null,
    });
    await store.dispatch(revertToSaved());
    const s = selectEditor(store.getState());
    expect(s.name).toBe('Reverted');
    expect(s.code).toBe('reverted');
    expect(s.saveState).toBe('saved');
    expect(s.running).toBe(false);
    expect(s.selection).toBeNull();
  });
});

describe('editorSlice reducers', () => {
  it('reset returns the initial state', () => {
    const store = makeStore({
      projectId: 'p-1',
      name: 'x',
      parts: [{ id: 'a' }],
      wires: [],
      code: 'x',
      saveState: 'dirty',
      selection: null,
      pending: null,
      view: '3d',
      running: true,
      sheetCollapsed: true,
      activeTab: 'serial',
      status: 'ready',
      error: null,
    });
    store.dispatch(reset());
    expect(selectEditor(store.getState()).projectId).toBeNull();
    expect(selectEditor(store.getState()).view).toBe('2d');
  });

  it('renameProject marks the doc dirty', () => {
    const store = makeStore();
    store.dispatch(renameProject('New name'));
    const s = selectEditor(store.getState());
    expect(s.name).toBe('New name');
    expect(s.saveState).toBe('dirty');
  });

  it('addPart appends a part with fresh props from its type definition', () => {
    const store = makeStore();
    store.dispatch(addPart({ type: 'led', x: 10, y: 20 }));
    const s = selectEditor(store.getState());
    expect(s.parts).toHaveLength(1);
    expect(s.parts[0]).toMatchObject({ type: 'led', x: 10, y: 20, rot: 0 });
    expect(s.parts[0].props).toEqual({ color: 'red' });
    expect(s.saveState).toBe('dirty');
  });

  it('addPart ignores an unknown type', () => {
    const store = makeStore();
    store.dispatch(addPart({ type: 'not-a-real-part', x: 0, y: 0 }));
    expect(selectEditor(store.getState()).parts).toHaveLength(0);
  });

  it('movePart updates position only for the matching part', () => {
    const store = makeStore({
      projectId: null, name: '', parts: [{ id: 'a', x: 0, y: 0 }], wires: [], code: '', saveState: 'saved',
      selection: null, pending: null, view: '2d', running: false, sheetCollapsed: false, activeTab: 'code',
      status: 'ready', error: null,
    });
    store.dispatch(movePart({ id: 'a', x: 50, y: 60 }));
    const part = selectEditor(store.getState()).parts[0];
    expect(part.x).toBe(50);
    expect(part.y).toBe(60);
    expect(selectEditor(store.getState()).saveState).toBe('dirty');
  });

  it('movePart is a no-op for an unknown id', () => {
    const store = makeStore();
    expect(() => store.dispatch(movePart({ id: 'nope', x: 1, y: 1 }))).not.toThrow();
  });

  it('rotatePart advances rotation by 90 and wraps at 360', () => {
    const store = makeStore({
      projectId: null, name: '', parts: [{ id: 'a', type: 'led', x: 100, y: 100, rot: 270, props: { color: 'red' } }],
      wires: [], code: '', saveState: 'saved', selection: null, pending: null, view: '2d', running: false,
      sheetCollapsed: false, activeTab: 'code', status: 'ready', error: null,
    });
    store.dispatch(rotatePart('a'));
    expect(selectEditor(store.getState()).parts[0].rot).toBe(0);
  });

  it('setPartProp sets a prop on the matching part only', () => {
    const store = makeStore({
      projectId: null, name: '', parts: [{ id: 'a', props: { color: 'red' } }, { id: 'b', props: { color: 'red' } }],
      wires: [], code: '', saveState: 'saved', selection: null, pending: null, view: '2d', running: false,
      sheetCollapsed: false, activeTab: 'code', status: 'ready', error: null,
    });
    store.dispatch(setPartProp({ id: 'a', key: 'color', value: 'green' }));
    const s = selectEditor(store.getState());
    expect(s.parts[0].props.color).toBe('green');
    expect(s.parts[1].props.color).toBe('red');
  });

  it('deletePart removes the part, only the wires touching it, and clears a matching selection', () => {
    const store = makeStore({
      projectId: null, name: '',
      parts: [{ id: 'a' }, { id: 'b' }],
      wires: [{ id: 'w-1', a: 'a.A', b: 'b.A' }, { id: 'w-2', a: 'b.A', b: 'b.B' }],
      code: '', saveState: 'saved', selection: { kind: 'part', id: 'a' }, pending: null, view: '2d',
      running: false, sheetCollapsed: false, activeTab: 'code', status: 'ready', error: null,
    });
    store.dispatch(deletePart('a'));
    const s = selectEditor(store.getState());
    expect(s.parts.map((p) => p.id)).toEqual(['b']);
    expect(s.wires.map((w) => w.id)).toEqual(['w-2']);
    expect(s.selection).toBeNull();
  });

  it('addWire connects two distinct pins and assigns a color', () => {
    const store = makeStore();
    store.dispatch(setPending('a.A'));
    store.dispatch(addWire({ a: 'a.A', b: 'b.A' }));
    const s = selectEditor(store.getState());
    expect(s.wires).toHaveLength(1);
    expect(s.wires[0]).toMatchObject({ a: 'a.A', b: 'b.A' });
    expect(s.wires[0].color).toBeTruthy();
    expect(s.pending).toBeNull();
  });

  it('addWire refuses a self-loop (same pin on both ends)', () => {
    const store = makeStore();
    store.dispatch(addWire({ a: 'a.A', b: 'a.A' }));
    expect(selectEditor(store.getState()).wires).toHaveLength(0);
  });

  it('addWire refuses a duplicate connection in either direction', () => {
    const store = makeStore({
      projectId: null, name: '', parts: [], wires: [{ id: 'w-1', a: 'a.A', b: 'b.A', color: '#fff' }], code: '',
      saveState: 'saved', selection: null, pending: null, view: '2d', running: false, sheetCollapsed: false,
      activeTab: 'code', status: 'ready', error: null,
    });
    store.dispatch(addWire({ a: 'b.A', b: 'a.A' }));
    expect(selectEditor(store.getState()).wires).toHaveLength(1);
  });

  it('deleteWire removes it and clears a matching selection', () => {
    const store = makeStore({
      projectId: null, name: '', parts: [], wires: [{ id: 'w-1', a: 'a.A', b: 'b.A', color: '#fff' }], code: '',
      saveState: 'saved', selection: { kind: 'wire', id: 'w-1' }, pending: null, view: '2d', running: false,
      sheetCollapsed: false, activeTab: 'code', status: 'ready', error: null,
    });
    store.dispatch(deleteWire('w-1'));
    const s = selectEditor(store.getState());
    expect(s.wires).toEqual([]);
    expect(s.selection).toBeNull();
  });

  it('setSelection replaces the selection and clears any pending wire start', () => {
    const store = makeStore();
    store.dispatch(setPending('a.A'));
    store.dispatch(setSelection({ kind: 'part', id: 'a' }));
    const s = selectEditor(store.getState());
    expect(s.selection).toEqual({ kind: 'part', id: 'a' });
    expect(s.pending).toBeNull();
  });

  it('setPending replaces the pending wire start and clears selection', () => {
    const store = makeStore();
    store.dispatch(setSelection({ kind: 'part', id: 'a' }));
    store.dispatch(setPending('a.A'));
    const s = selectEditor(store.getState());
    expect(s.pending).toBe('a.A');
    expect(s.selection).toBeNull();
  });

  it('clearInteraction clears both selection and pending', () => {
    const store = makeStore();
    store.dispatch(setSelection({ kind: 'part', id: 'a' }));
    store.dispatch(clearInteraction());
    const s = selectEditor(store.getState());
    expect(s.selection).toBeNull();
    expect(s.pending).toBeNull();
  });

  it('setCode and loadExampleCode both mark the doc dirty', () => {
    const store = makeStore();
    store.dispatch(setCode('void loop() {}'));
    expect(selectEditor(store.getState()).code).toBe('void loop() {}');
    expect(selectEditor(store.getState()).saveState).toBe('dirty');

    store.dispatch(loadExampleCode('// example'));
    expect(selectEditor(store.getState()).code).toBe('// example');
  });

  it('setView switches views', () => {
    const store = makeStore();
    store.dispatch(setView('3d'));
    expect(selectEditor(store.getState()).view).toBe('3d');
  });

  it('setRunning(true) clears selection and pending', () => {
    const store = makeStore();
    store.dispatch(setSelection({ kind: 'part', id: 'a' }));
    store.dispatch(setRunning(true));
    const s = selectEditor(store.getState());
    expect(s.running).toBe(true);
    expect(s.selection).toBeNull();
  });

  it('toggleSheetCollapsed flips the flag', () => {
    const store = makeStore();
    store.dispatch(toggleSheetCollapsed());
    expect(selectEditor(store.getState()).sheetCollapsed).toBe(true);
    store.dispatch(toggleSheetCollapsed());
    expect(selectEditor(store.getState()).sheetCollapsed).toBe(false);
  });

  it('setActiveTab switches tabs', () => {
    const store = makeStore();
    store.dispatch(setActiveTab('serial'));
    expect(selectEditor(store.getState()).activeTab).toBe('serial');
  });
});
