import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { saveProject } from '../projectsSlice';
import { TAGS } from '@/lib/templates';

export default function TagsModal({ project, close }) {
  const [tags, setTags] = useState(new Set(project.tags || []));
  const dispatch = useDispatch();

  function toggle(tag) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function onSave() {
    dispatch(saveProject({ id: project.id, patch: { tags: [...tags] } }));
    close();
  }

  return (
    <>
      <h2>Edit tags</h2>
      <p>Helps people find this circuit in Community Circuits.</p>
      <div className="fchips" style={{ marginTop: 14 }}>
        {TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className={`fchip${tags.has(t) ? ' on' : ''}`}
            onClick={() => toggle(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button className="btn primary" onClick={onSave}>
          Save tags
        </button>
      </div>
    </>
  );
}
