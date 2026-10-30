import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import { rid } from '@/lib/id';
import { TYPES } from './engine/constants';
import { snapPartPos } from './engine/geometry';

/**
 * The circuit editor's *document* state — everything that gets persisted
 * (parts/wires/code) plus coarse, discrete-action UI state (selection,
 * view mode, running flag). Deliberately does NOT hold per-frame
 * simulation output (LED brightness, servo angle, etc.) — that lives in
 * engine/engineStore.js outside Redux so the render loop never dispatches
 * at animation-frame rate. See the plan's "Redux vs engine-internal state
 * split" note.
 */
export const loadProject = createAsyncThunk('editor/load', async (id) => {
  const project = await api.project(id);
  if (!project) throw new Error('Project not found.');
  return project;
});

export const flushSave = createAsyncThunk('editor/flushSave', async (_, { getState }) => {
  const s = getState().editor;
  // Nothing unsaved: don't write, or a live circuit would be sent back to review for no reason.
  if (!s.projectId || s.saveState === 'saved') return null;
  return api.save(s.projectId, { name: s.name, parts: s.parts, wires: s.wires, code: s.code });
});

/** Discards unsaved changes by re-reading this project's last-saved
 * name/parts/wires/code back off disk — the counterpart to flushSave. */
export const revertToSaved = createAsyncThunk('editor/revertToSaved', async (_, { getState }) => {
  const s = getState().editor;
  const project = await api.project(s.projectId);
  if (!project) throw new Error('Project not found.');
  return project;
});

const initialState = {
  projectId: null,
  name: '',
  parts: [],
  wires: [],
  code: '',
  selection: null, // { kind: 'part' | 'wire', id }
  pending: null, // pending wire start, e.g. "ard.D13"
  view: '2d', // '2d' | '3d'
  running: false,
  sheetCollapsed: false,
  activeTab: 'code', // 'code' | 'serial'
  status: 'idle', // idle | loading | ready | error
  saveState: 'saved', // saved | saving | dirty
  approved: false, // live in Community Circuits: a save sends it back to review
  error: null,
};

function nextWireColor(wires) {
  const palette = ['#ffd166', '#4cc9f0', '#ff9f1c', '#c77dff', '#80ed99', '#f15bb5'];
  return palette[wires.length % palette.length];
}

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    reset() {
      return initialState;
    },
    renameProject(state, action) {
      state.name = action.payload;
      state.saveState = 'dirty';
    },
    addPart(state, action) {
      const { type, x, y } = action.payload;
      const def = TYPES[type];
      if (!def) return;
      state.parts.push({
        id: rid(type + '-'),
        type,
        x,
        y,
        rot: 0,
        props: JSON.parse(JSON.stringify(def.props || {})),
      });
      state.saveState = 'dirty';
    },
    movePart(state, action) {
      const { id, x, y } = action.payload;
      const p = state.parts.find((part) => part.id === id);
      if (p) {
        p.x = x;
        p.y = y;
        state.saveState = 'dirty';
      }
    },
    rotatePart(state, action) {
      const p = state.parts.find((part) => part.id === action.payload);
      if (p) {
        p.rot = ((p.rot || 0) + 90) % 360;
        const [x, y] = snapPartPos(p, p.x, p.y);
        p.x = x;
        p.y = y;
        state.saveState = 'dirty';
      }
    },
    setPartProp(state, action) {
      const { id, key, value } = action.payload;
      const p = state.parts.find((part) => part.id === id);
      if (p) {
        p.props[key] = value;
        state.saveState = 'dirty';
      }
    },
    deletePart(state, action) {
      const id = action.payload;
      state.parts = state.parts.filter((p) => p.id !== id);
      state.wires = state.wires.filter((w) => !w.a.startsWith(id + '.') && !w.b.startsWith(id + '.'));
      if (state.selection?.id === id) state.selection = null;
      state.saveState = 'dirty';
    },
    addWire(state, action) {
      const { a, b } = action.payload;
      const dup = state.wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
      if (!dup && a !== b) {
        state.wires.push({ id: rid('w-'), a, b, color: nextWireColor(state.wires) });
        state.saveState = 'dirty';
      }
      state.pending = null;
    },
    deleteWire(state, action) {
      state.wires = state.wires.filter((w) => w.id !== action.payload);
      if (state.selection?.id === action.payload) state.selection = null;
      state.saveState = 'dirty';
    },
    setSelection(state, action) {
      state.selection = action.payload;
      state.pending = null;
    },
    setPending(state, action) {
      state.pending = action.payload;
      state.selection = null;
    },
    clearInteraction(state) {
      state.selection = null;
      state.pending = null;
    },
    setCode(state, action) {
      state.code = action.payload;
      state.saveState = 'dirty';
    },
    loadExampleCode(state, action) {
      state.code = action.payload;
      state.saveState = 'dirty';
    },
    setView(state, action) {
      state.view = action.payload;
    },
    setRunning(state, action) {
      state.running = action.payload;
      if (action.payload) {
        state.selection = null;
        state.pending = null;
      }
    },
    toggleSheetCollapsed(state) {
      state.sheetCollapsed = !state.sheetCollapsed;
    },
    setActiveTab(state, action) {
      state.activeTab = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProject.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadProject.fulfilled, (state, action) => {
        const p = action.payload;
        state.status = 'ready';
        state.projectId = p.id;
        state.name = p.name;
        state.parts = p.parts;
        state.wires = p.wires;
        state.code = p.code;
        state.approved = !!p.approved;
        state.selection = null;
        state.pending = null;
        state.running = false;
        state.saveState = 'saved';
      })
      .addCase(revertToSaved.fulfilled, (state, action) => {
        const p = action.payload;
        state.name = p.name;
        state.parts = p.parts;
        state.wires = p.wires;
        state.code = p.code;
        state.selection = null;
        state.pending = null;
        state.running = false;
        state.saveState = 'saved';
      })
      .addCase(loadProject.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      })
      .addCase(flushSave.pending, (state) => {
        if (state.saveState === 'dirty') state.saveState = 'saving';
      })
      .addCase(flushSave.fulfilled, (state, action) => {
        state.saveState = 'saved';
        if (action.payload) state.approved = !!action.payload.approved;
      });
  },
});

export const {
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
} = editorSlice.actions;
export default editorSlice.reducer;

export const selectEditor = (state) => state.editor;
