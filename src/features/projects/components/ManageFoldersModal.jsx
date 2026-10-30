import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createFolder, renameFolder, deleteFolder, selectProjectsState } from '../projectsSlice';
import { openModal } from '@/features/ui/uiSlice';
import { MAX_FOLDERS } from '@/lib/limits';

export default function ManageFoldersModal({ close }) {
  const { folders } = useSelector(selectProjectsState);
  const dispatch = useDispatch();
  const full = folders.length >= MAX_FOLDERS;
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function onCreate(e) {
    e.preventDefault();
    if (newName.trim()) dispatch(createFolder(newName.trim()));
    setNewName('');
  }

  function startRename(f) {
    setEditingId(f.id);
    setEditingName(f.name);
  }

  function saveRename() {
    if (editingName.trim()) dispatch(renameFolder({ id: editingId, name: editingName.trim() }));
    setEditingId(null);
  }

  function onDelete(f) {
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: `Delete "${f.name}"?`,
          body: 'Projects inside will move to "No folder". This cannot be undone.',
          confirmLabel: 'Delete folder',
          onConfirm: () => dispatch(deleteFolder(f.id)),
        },
      }),
    );
  }

  return (
    <>
      <h2>Manage folders</h2>
      <form className="row" onSubmit={onCreate}>
        <div className="field" style={{ flex: 1 }}>
          <input
            className="input"
            placeholder={full ? `Up to ${MAX_FOLDERS} folders` : 'New folder name'}
            disabled={full}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <button className="btn primary" type="submit" disabled={full}>
          Add
        </button>
      </form>
      <div className="action-list">
        {folders.length === 0 && <p className="muted small">No folders yet.</p>}
        {folders.map((f) => (
          <div key={f.id} className="row" style={{ justifyContent: 'space-between', margin: '4px 0' }}>
            {editingId === f.id ? (
              <input
                className="input"
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              />
            ) : (
              <span>{f.name}</span>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => startRename(f)}>
                Rename
              </button>
              <button className="btn danger" onClick={() => onDelete(f)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Done
        </button>
      </div>
    </>
  );
}
