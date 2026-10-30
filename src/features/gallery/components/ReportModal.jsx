import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '@/lib/api';
import { showToast } from '@/features/ui/uiSlice';

const REASONS = ['Spam or advertising', 'Offensive or inappropriate', 'Copied from someone else', 'Broken or misleading', 'Other'];

/** Flags a shared circuit for the admins. One report per user per circuit. */
export default function ReportModal({ item, note = '', close }) {
  const dispatch = useDispatch();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const text = details.trim() ? `${reason}: ${details.trim()}` : reason;
      await api.reportCircuit(item.id, `${note}${text}`.slice(0, 500));
      dispatch(showToast('Thanks. An admin will take a look.'));
      close();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Report “{item.name}”</h2>
      <p>Tell the admins what is wrong. They can take it down.</p>
      <div className="field">
        <label htmlFor="report-reason">Reason</label>
        <select id="report-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="report-details">Details (optional)</label>
        <textarea
          id="report-details"
          className="input"
          rows={3}
          maxLength={400}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <button type="submit" className="btn danger" disabled={busy}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}
