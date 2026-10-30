import { useState } from 'react';

/** Generic "are you sure?" dialog, registered under modal type "confirm". */
export default function ConfirmModal({
  title = 'Are you sure?',
  body = '',
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  close,
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm?.();
    } catch {
      // The action failed, but this dialog's job is done either way — the
      // triggering code is responsible for surfacing its own error (e.g. a toast).
    } finally {
      close();
    }
  }

  return (
    <>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      <div className="modal-actions">
        <button className="btn" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={handleConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </>
  );
}
