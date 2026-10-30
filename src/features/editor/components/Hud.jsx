import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { renameProject, setView, setRunning, flushSave, revertToSaved, rotatePart } from '../editorSlice';
import { openModal, showToast } from '@/features/ui/uiSlice';
import { api } from '@/lib/api';
import { primeAudio } from '../engine/audio';

export default function Hud({ name, saveState, view, running, projectId, live, selection, onAudioWarn }) {
  const dispatch = useDispatch();

  async function onShare() {
    await dispatch(flushSave());
    const project = await api.project(projectId);
    if (project) dispatch(openModal({ type: 'publish', props: { project } }));
  }

  async function save() {
    const res = await dispatch(flushSave());
    dispatch(showToast(flushSave.fulfilled.match(res) ? 'Saved.' : res.error.message));
  }

  // Only the owner can edit a circuit; saving a live one sends it back for review, so ask first.
  function onSave() {
    if (!live || saveState !== 'dirty') return save();
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: 'Save changes to a shared circuit?',
          body: 'Saving sends this circuit back to an admin for review. It leaves Community Circuits until it is approved again.',
          confirmLabel: 'Save and resubmit',
          onConfirm: save,
        },
      }),
    );
  }

  function onReset() {
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: 'Reset to last save?',
          body: 'This discards every change since your last save and restores the circuit exactly as it was then. This cannot be undone.',
          confirmLabel: 'Reset circuit',
          onConfirm: async () => {
            await dispatch(revertToSaved());
            dispatch(showToast('Circuit reset to last save.'));
          },
        },
      }),
    );
  }

  function onToggleRun() {
    // Resume from inside this click handler rather than later in the
    // dispatch -> effect -> interpreter chain, so browsers that require a
    // genuine user gesture for audio always see one. If they still refuse,
    // primeAudio reports it to the serial console instead of going silent.
    if (!running) primeAudio(onAudioWarn);
    dispatch(setRunning(!running));
  }

  // The listener is added once; it reads the latest handlers through this ref.
  const keys = useRef();
  keys.current = (e) => {
    const dialogOpen = !!document.querySelector('.modal-back'); // then its buttons are the only controls
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault(); // never the browser's "Save page"
      return dialogOpen ? undefined : onSave();
    }
    if (dialogOpen) return;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      return onToggleRun();
    }
    // Plain keys only outside text fields, so typing a sketch never triggers them.
    if (mod || e.altKey || e.target.closest?.('textarea,select,input')) return;
    if (e.key === '?') dispatch(openModal({ type: 'shortcuts', props: {} }));
    else if (e.key === '2' || e.key === '3') dispatch(setView(`${e.key}d`));
    else if (e.key.toLowerCase() === 'r' && !running && selection?.kind === 'part') dispatch(rotatePart(selection.id));
  };
  useEffect(() => {
    const onKey = (e) => keys.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="editor-hud glass">
      <Link to="/projects" className="icon-btn" aria-label="Back to your projects">
        &larr;
      </Link>
      <div className="editor-proj">
        <input
          className="editor-proj-name"
          aria-label="Project name"
          autoComplete="off"
          spellCheck={false}
          value={name}
          onChange={(e) => dispatch(renameProject(e.target.value))}
        />
        <span className="editor-save-state">
          {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved changes' : 'Saved on this device'}
        </span>
      </div>
      <div className="editor-viewtoggle" role="group" aria-label="View">
        <button className={view === '2d' ? 'on' : ''} onClick={() => dispatch(setView('2d'))}>
          2D
        </button>
        <button className={view === '3d' ? 'on' : ''} onClick={() => dispatch(setView('3d'))}>
          3D
        </button>
      </div>
      <div className="editor-actions">
        <button className="btn" onClick={onSave}>
          Save
        </button>
        <button className="btn danger" onClick={onReset}>
          Reset
        </button>
        <button className="btn" onClick={onShare}>
          Share
        </button>
        <button
          className="icon-btn"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={() => dispatch(openModal({ type: 'shortcuts', props: {} }))}
        >
          ?
        </button>
        <button className={`btn run${running ? ' live' : ''}`} onClick={onToggleRun}>
          {running ? '■ Stop' : '▶ Run'}
        </button>
      </div>
    </header>
  );
}
