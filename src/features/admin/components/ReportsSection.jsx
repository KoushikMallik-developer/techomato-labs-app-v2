import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { api } from '@/lib/api';
import { openModal, showToast } from '@/features/ui/uiSlice';
import { rejectCircuit } from '../adminSlice';

/** Circuits users reported. Take one down (it goes back to its owner, unpublished) or dismiss the report. */
export default function ReportsSection() {
  const dispatch = useDispatch();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    api.adminReports().then(setReports, () => setReports([]));
  }, []);

  async function dismiss(report) {
    try {
      await api.dismissReport(report.id);
      setReports((list) => list.filter((r) => r.id !== report.id));
    } catch (err) {
      dispatch(showToast(err.message));
    }
  }

  function takeDown(report) {
    const thread = report.projectId.startsWith('thread:');
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: thread ? 'Delete this discussion?' : 'Take this circuit down?',
          body: thread
            ? 'The post and all its comments are removed for good.'
            : 'It leaves Community Circuits and goes back to its owner as unpublished. They can fix it and share it again.',
          confirmLabel: thread ? 'Delete' : 'Take down',
          onConfirm: async () => {
            const res = thread
              ? await api.deleteThread(report.projectId.slice(7)).then(
                  () => ({ ok: true }),
                  () => ({ ok: false }),
                )
              : await dispatch(rejectCircuit(report.projectId));
            // Either way every report about this circuit is handled: if the update was refused, its owner had
            // already unpublished or deleted it.
            await Promise.all(reports.filter((r) => r.projectId === report.projectId).map(dismiss));
            dispatch(showToast(res.ok || rejectCircuit.fulfilled.match(res) ? 'Taken down.' : 'That was already removed or unshared. Report closed.'));
          },
        },
      }),
    );
  }

  return (
    <>
      <div className="head" style={{ marginTop: 40 }}>
        <div>
          <h1>Reports</h1>
          <p>Circuits users flagged, newest first.</p>
        </div>
      </div>
      <div className="action-list">
        {reports.length === 0 && <p className="muted small">No open reports.</p>}
        {reports.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 12, margin: '6px 0' }}>
            <span>
              {r.projectId.startsWith('thread:') ? (
                <Link to={`/discussions/${r.projectId.slice(7)}`}>Open discussion</Link>
              ) : (
                <Link to={`/community/${r.projectId}`}>Open circuit</Link>
              )}
              <br />
              <span className="muted small">{r.reason}</span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => dismiss(r)}>
                Dismiss
              </button>
              <button className="btn danger" onClick={() => takeDown(r)}>
                Take down
              </button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
