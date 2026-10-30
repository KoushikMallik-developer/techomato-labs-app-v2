import { useDispatch, useSelector } from 'react-redux';
import { moveToFolder, selectProjectsState } from '../projectsSlice';

export default function FolderPickerModal({ project, close }) {
  const { folders } = useSelector(selectProjectsState);
  const dispatch = useDispatch();

  function pick(folderId) {
    dispatch(moveToFolder({ id: project.id, folderId }));
    close();
  }

  return (
    <>
      <h2>Move to folder</h2>
      <div className="action-list">
        <button onClick={() => pick(null)}>No folder</button>
        {folders.map((f) => (
          <button key={f.id} onClick={() => pick(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Cancel
        </button>
      </div>
    </>
  );
}
