import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { saveProject } from '../projectsSlice';

export default function RenameModal({ project, close }) {
  const [name, setName] = useState(project.name);
  const dispatch = useDispatch();

  function onSubmit(e) {
    e.preventDefault();
    const clean = name.trim();
    if (clean && clean !== project.name) dispatch(saveProject({ id: project.id, patch: { name: clean } }));
    close();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Rename project</h2>
      {project.approved && (
        <p className="small muted">This circuit is in Community Circuits. Renaming sends it back for review.</p>
      )}
      <div className="field">
        <label htmlFor="rename-input">Name</label>
        <input
          id="rename-input"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Save
        </button>
      </div>
    </form>
  );
}
