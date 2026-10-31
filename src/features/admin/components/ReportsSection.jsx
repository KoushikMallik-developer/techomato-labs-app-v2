import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '@/lib/api';
import { REPORTS_SHOWN } from '@/lib/limits';
import { openModal, showToast } from '@/features/ui/uiSlice';
import { dismissReport, rejectCircuit, selectAdminLoaded, selectAdminReports } from '../adminSlice';
import { timeAgo } from '../timeAgo';

/** Reports grouped by what was reported. Take the circuit or discussion down, or dismiss reports one by one. */
export default function ReportsSection() {
  const dispatch = useDispatch();
  const reports = useSelector(selectAdminReports);
  const loaded = useSelector(selectAdminLoaded).reports;

  // Newest report first, so a target sits where its latest report is.
  const groups = [];
  for (const r of reports) {
    const g = groups.find((x) => x.projectId === r.projectId);
    if (g) g.items.push(r);
    else groups.push({ projectId: r.projectId, items: [r] });
  }

  function takeDown(group) {
    const thread = group.projectId.startsWith('thread:');
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
              ? await api.deleteThread(group.projectId.slice(7)).then(
                  () => ({ ok: true }),
                  () => ({ ok: false }),
                )
              : await dispatch(rejectCircuit(group.projectId));
            // Either way every report about it is handled: if the update was refused, its owner had
            // already unpublished or deleted it.
            const closed = await dispatch(dismissReport(group.items.map((r) => r.id)));
            if (closed.payload.length < group.items.length) return; // the thunk already said which part failed
            dispatch(
              showToast(
                res.ok || rejectCircuit.fulfilled.match(res)
                  ? 'Taken down.'
                  : 'That was already removed or unshared. Report closed.',
              ),
            );
          },
        },
      }),
    );
  }

  if (!loaded) return <p className="muted">Loading&hellip;</p>;
  if (groups.length === 0) {
    return (
      <div className="empty glass">
        <h2>No open reports</h2>
        <p className="muted">Anything users flag will show up here.</p>
      </div>
    );
  }

  return (
    <div className="adm-list">
      {reports.length >= REPORTS_SHOWN && (
        <p className="muted small">Showing the newest {REPORTS_SHOWN} reports. Clear some to see older ones.</p>
      )}
      {groups.map((g) => {
        const thread = g.projectId.startsWith('thread:');
        return (
          <div key={g.projectId} className="adm-row glass">
            <div className="adm-row-head">
              {thread ? (
                <Link to={`/discussions/${g.projectId.slice(7)}`}>Open discussion</Link>
              ) : (
                <Link to={`/community/${g.projectId}`}>Open circuit</Link>
              )}
              <span className="badge">
                {g.items.length} {g.items.length === 1 ? 'report' : 'reports'}
              </span>
              <button className="btn danger" onClick={() => takeDown(g)}>
                Take down
              </button>
            </div>
            <ul className="adm-reasons">
              {g.items.map((r) => (
                <li key={r.id}>
                  <span>
                    {r.reason} <span className="muted small">· {timeAgo(r.createdAt)}</span>
                  </span>
                  <button className="btn small" onClick={() => dispatch(dismissReport([r.id]))}>
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
