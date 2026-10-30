import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import BrandMark from '@/components/BrandMark';
import { fetchPending, approveCircuit, rejectCircuit, adminLogout, selectPendingCircuits } from '../adminSlice';

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export default function AdminPanelPage() {
  const dispatch = useDispatch();
  const pending = useSelector(selectPendingCircuits);

  useEffect(() => {
    dispatch(fetchPending());
  }, [dispatch]);

  return (
    <div className="page">
      <header className="nav">
        <div className="container nav-in">
          <Link to="/" className="brand">
            <BrandMark />
            <b>Techomato Labs</b>
            <span className="badge" style={{ marginLeft: 4 }}>
              Admin
            </span>
          </Link>
          <div className="nav-right">
            <button className="btn" onClick={() => dispatch(adminLogout())}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="container wrap">
        <div className="head">
          <div>
            <h1>Pending approval</h1>
            <p>Circuits submitted to Community Circuits, waiting for review.</p>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="empty glass">
            <h2>Nothing to review</h2>
            <p className="muted">New submissions will show up here.</p>
          </div>
        ) : (
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
                <div className="pcard-foot" style={{ gap: 8 }}>
                  <button className="btn danger" onClick={() => dispatch(rejectCircuit(item.id))}>
                    Reject
                  </button>
                  <button className="btn primary" onClick={() => dispatch(approveCircuit(item.id))}>
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
