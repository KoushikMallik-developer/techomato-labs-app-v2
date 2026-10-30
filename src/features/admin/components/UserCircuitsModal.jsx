import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

/** The circuits one user has published to Community Circuits, opened from the admin panel's user list. */
export default function UserCircuitsModal({ user, close }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.adminUserCircuits(user.id).then(setItems, () => setItems([]));
  }, [user.id]);

  return (
    <>
      <h2>@{user.handle}</h2>
      <p className="sub">Circuits in Community</p>
      <div className="action-list">
        {items === null && <p className="muted small">Loading…</p>}
        {items?.length === 0 && <p className="muted small">Nothing published.</p>}
        {items?.map((i) => (
          <Link key={i.id} to={`/community/${i.id}`} onClick={close}>
            {i.name} <span className="muted small">· {i.likeCount} likes</span>
            {i.tags.length > 0 && <span className="muted small"> · {i.tags.join(', ')}</span>}
          </Link>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Close
        </button>
      </div>
    </>
  );
}
