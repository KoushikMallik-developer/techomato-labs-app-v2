import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { renameProject, setView, setRunning, flushSave, revertToSaved } from '../editorSlice';
import { openModal, showToast } from '@/features/ui/uiSlice';
import { api } from '@/lib/api';
import { primeAudio } from '../engine/audio';

export default function Hud({ name, saveState, view, running, projectId, onAudioWarn }) {
  const dispatch = useDispatch();

  async function onShare() {
    await dispatch(flushSave());
    const project = await api.project(projectId);
    if (project) dispatch(openModal({ type: 'publish', props: { project } }));
  }

  async function onSave() {
    await dispatch(flushSave());
    dispatch(showToast('Saved.'));
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
        <button className={`btn run${running ? ' live' : ''}`} onClick={onToggleRun}>
          {running ? '■ Stop' : '▶ Run'}
        </button>
      </div>
    </header>
  );
}
