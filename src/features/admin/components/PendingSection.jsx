import { useDispatch, useSelector } from 'react-redux';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import {
  approveCircuit,
  rejectCircuit,
  selectAdminLoaded,
  selectPendingCircuits,
} from '../adminSlice';
import { timeAgo } from '../timeAgo';

/** Circuits submitted to Community Circuits, waiting for a decision. */
export default function PendingSection() {
  const dispatch = useDispatch();
  const pending = useSelector(selectPendingCircuits);
  const loaded = useSelector(selectAdminLoaded).pending;

  if (!loaded) return <p className="muted">Loading&hellip;</p>;
  if (pending.length === 0) {
    return (
      <div className="empty glass">
        <h2>Nothing to review</h2>
        <p className="muted">New submissions will show up here.</p>
      </div>
    );
  }

  return (
    <div className="cards">
      {pending.map((item) => (
        <div className="pcard glass" key={item.id}>
          <div className="thumb">
            <CircuitThumbnail parts={item.parts} wires={item.wires} />
          </div>
          <div className="pcard-body">
            <span className="pname">{item.name}</span>
            <span className="small muted">
              by @{item.author} · submitted {timeAgo(item.publishedAt || item.updatedAt)}
            </span>
            {item.description && <p className="small muted">{item.description}</p>}
            {item.tags?.length > 0 && (
              <div className="tags">
                {item.tags.map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="pcard-foot">
            <button className="btn danger" onClick={() => dispatch(rejectCircuit(item.id))}>
              Reject
            </button>
            <button
              className="btn primary"
              onClick={() => dispatch(approveCircuit({ id: item.id, seen: item.updatedAt }))}
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
