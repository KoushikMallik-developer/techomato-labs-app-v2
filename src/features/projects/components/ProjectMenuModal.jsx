import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { openModal, closeModal, showToast } from '@/features/ui/uiSlice';
import { removeProject, duplicateProject } from '../projectsSlice';
import { api } from '@/lib/api';

export default function ProjectMenuModal({ project, close }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  function openEditor() {
    close();
    navigate(`/editor/${project.id}`);
  }

  function rename() {
    dispatch(openModal({ type: 'rename-project', props: { project } }));
  }

  function moveToFolder() {
    dispatch(openModal({ type: 'folder-picker', props: { project } }));
  }

  function editTags() {
    dispatch(openModal({ type: 'edit-tags', props: { project } }));
  }

  async function duplicate() {
    const res = await dispatch(duplicateProject(project.id));
    if (duplicateProject.fulfilled.match(res)) {
      dispatch(showToast('Project duplicated.'));
      close();
    }
  }

  async function exportJson() {
    const doc = await api.exportProject(project.id);
    const json = JSON.stringify(doc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '_') || 'circuit'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    close();
  }

  function share() {
    dispatch(openModal({ type: 'publish', props: { project } }));
  }

  async function copyLink() {
    const url = `${window.location.origin}/community/${project.id}`;
    try {
      await navigator.clipboard.writeText(url);
      dispatch(showToast('Link copied.'));
    } catch {
      window.prompt('Copy this link:', url);
    }
    close();
  }

  function del() {
    dispatch(closeModal());
    setTimeout(
      () =>
        dispatch(
          openModal({
            type: 'confirm',
            props: {
              title: `Delete "${project.name}"?`,
              body: 'This cannot be undone.',
              confirmLabel: 'Delete project',
              onConfirm: () => dispatch(removeProject(project.id)),
            },
          }),
        ),
      0,
    );
  }

  return (
    <>
      <h2>{project.name}</h2>
      <div className="action-list">
        <button onClick={openEditor}>Open in editor</button>
        <button onClick={rename}>Rename</button>
        <button onClick={moveToFolder}>Move to folder</button>
        <button onClick={editTags}>Edit tags</button>
        <button onClick={duplicate}>Duplicate</button>
        <button onClick={exportJson}>Export JSON</button>
        {project.approved && <button onClick={copyLink}>Copy Community Circuits link</button>}
        <button onClick={share}>
          {project.published
            ? project.approved
              ? 'Edit Community Circuits listing'
              : 'Edit submission (pending approval)'
            : 'Share to Community Circuits'}
        </button>
        <button className="danger" onClick={del}>
          Delete
        </button>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Close
        </button>
      </div>
    </>
  );
}
