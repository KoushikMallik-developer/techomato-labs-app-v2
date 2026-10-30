import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { saveProject } from '../projectsSlice';

export default function RenameModal({ project, close }) {
  const [name, setName] = useState(project.name);
  const dispatch = useDispatch();

  function onSubmit(e) {
    e.preventDefault();
    if (name.trim()) dispatch(saveProject({ id: project.id, patch: { name: name.trim() } }));
    close();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Rename project</h2>
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
