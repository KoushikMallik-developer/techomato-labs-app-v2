import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AppShell from '@/components/AppShell';
import { fetchNotifications, markAllRead, selectNotifications } from '../notificationsSlice';

const WHAT = {
  like: 'liked your circuit',
  comment: 'commented on your circuit',
  reply: 'replied in a discussion',
};

const linkFor = (n) => (n.type === 'reply' ? `/discussions/${n.targetId}` : `/community/${n.targetId}`);

/** Likes and comments on your circuits, and replies to your discussions, newest first. */
export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { items, status } = useSelector(selectNotifications);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const unread = items.some((n) => !n.read);

  return (
    <AppShell title="Notifications">
      <div className="head">
        <div>
          <p>The newest 30. Likes and comments on your circuits, and replies to your discussions.</p>
        </div>
        {unread && (
          <button className="btn" onClick={() => dispatch(markAllRead())}>
            Mark all as read
          </button>
        )}
      </div>
      {status !== 'ready' && items.length === 0 ? (
        <p className="muted">Loading&hellip;</p>
      ) : items.length === 0 ? (
        <div className="empty glass">
          <h2>All quiet</h2>
          <p className="muted">When someone likes or comments on your work, it shows up here.</p>
        </div>
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={`notif glass${n.read ? '' : ' unread'}`}>
              <Link to={linkFor(n)}>
                <b>@{n.from}</b> {WHAT[n.type] || 'did something'}
                {n.text && <span className="muted"> · “{n.text}”</span>}
              </Link>
              <span className="small muted">{new Date(n.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
