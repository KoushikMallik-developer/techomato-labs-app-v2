import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { publishProject, unpublishProject } from '../projectsSlice';
import { showToast } from '@/features/ui/uiSlice';
import { TAGS } from '@/lib/templates';

export default function PublishModal({ project, close }) {
  const [description, setDescription] = useState(project.description || '');
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

  async function onPublish() {
    const res = await dispatch(publishProject({ id: project.id, meta: { description, tags: [...tags] } }));
    if (publishProject.fulfilled.match(res)) {
      dispatch(showToast('Submitted for admin approval.'));
      close();
    }
  }

  async function onUnpublish() {
    await dispatch(unpublishProject(project.id));
    dispatch(showToast('Removed from Community Circuits.'));
    close();
  }

  return (
    <>
      <h2>{project.published ? 'Update your submission' : 'Share to Community Circuits'}</h2>
      <p>
        {project.published
          ? 'Changes go back to an admin for re-approval before they show up publicly again.'
          : "An admin reviews every submission — once approved, anyone can view, remix, like, and comment on it."}
      </p>
      {project.published && !project.approved && <p className="form-error">Awaiting admin approval — not public yet.</p>}
      <div className="field">
        <label htmlFor="pub-desc">Description</label>
        <textarea
          id="pub-desc"
          className="input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this circuit do?"
        />
      </div>
      <div className="fchips" style={{ marginTop: 14 }}>
        {TAGS.map((t) => (
          <button key={t} type="button" className={`fchip${tags.has(t) ? ' on' : ''}`} onClick={() => toggle(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="modal-actions">
        {project.published && (
          <button className="btn danger" onClick={onUnpublish}>
            {project.approved ? 'Remove from Community Circuits' : 'Cancel submission'}
          </button>
        )}
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button className="btn primary" onClick={onPublish}>
          {project.published ? 'Resubmit for approval' : 'Submit for approval'}
        </button>
      </div>
    </>
  );
}
