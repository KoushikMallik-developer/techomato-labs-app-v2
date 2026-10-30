import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '@/features/auth/authSlice';
import { deleteComment } from '../gallerySlice';

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

export default function CommentList({ itemId, comments }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();

  if (comments.length === 0) return <p className="muted small" style={{ marginTop: 10 }}>No comments yet.</p>;

  return (
    <div>
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <div className="comment-head">
            <strong>{c.name}</strong>
            <span className="small muted">{timeAgo(c.createdAt)}</span>
            {user?.id === c.userId && (
              <button
                className="icon-btn"
                aria-label="Delete comment"
                onClick={() => dispatch(deleteComment({ itemId, commentId: c.id }))}
              >
                &times;
              </button>
            )}
          </div>
          <p>{c.text}</p>
        </div>
      ))}
    </div>
  );
}
