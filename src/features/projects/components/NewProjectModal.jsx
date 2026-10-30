import { useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createProject } from '../projectsSlice';
import { TEMPLATES, buildTemplate } from '@/lib/templates';
import CircuitThumbnail from '@/components/CircuitThumbnail';

export default function NewProjectModal({ close }) {
  const [key, setKey] = useState('blank');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const previews = useMemo(
    () => Object.fromEntries(TEMPLATES.map((t) => [t.key, buildTemplate(t.key)])),
    [],
  );

  async function onCreate() {
    setBusy(true);
    const tpl = TEMPLATES.find((t) => t.key === key);
    const res = await dispatch(createProject({ templateKey: key, name: name.trim() || tpl?.name || 'Untitled circuit' }));
    setBusy(false);
    if (createProject.fulfilled.match(res)) {
      close();
      navigate(`/editor/${res.payload.id}`);
    }
  }

  return (
    <>
      <h2>New project</h2>
      <p>Start blank, or from a working circuit you can pull apart.</p>
      <div className="field">
        <label htmlFor="new-proj-name">Name</label>
        <input
          id="new-proj-name"
          className="input"
          placeholder="Untitled circuit"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`tpl${key === t.key ? ' on' : ''}`}
            onClick={() => setKey(t.key)}
          >
            <div className="thumb">
              <CircuitThumbnail parts={previews[t.key].parts} wires={previews[t.key].wires} />
            </div>
            <b>{t.name}</b>
            <small>{t.hint}</small>
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button className="btn primary" onClick={onCreate} disabled={busy}>
          {busy ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </>
  );
}
