import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { openModal } from '@/features/ui/uiSlice';
import CircuitThumbnail from './CircuitThumbnail';

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1 4 2.5C10.5 6 12 5 14 5c3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21z" />
    </svg>
  );
}

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v}${name[0]} ago`;
  }
  return 'today';
}

export default function GalleryCard({ item, liked, onLike }) {
  const dispatch = useDispatch();
  return (
    <div className="pcard glass">
      <Link to={`/community/${item.id}`} className="thumb" aria-label={`Open ${item.name}`}>
        <CircuitThumbnail parts={item.parts} wires={item.wires} />
      </Link>
      <div className="pcard-body">
        <Link to={`/community/${item.id}`} className="pname">
          {item.name}
        </Link>
        <span className="small muted">
          by{' '}
          <button
            className="link-inline"
            style={{ all: 'unset', color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => dispatch(openModal({ type: 'author', props: { handle: item.author } }))}
          >
            @{item.author}
          </button>
          , {timeAgo(item.publishedAt || item.createdAt)}
        </span>
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
        <button className={`like${liked ? ' on' : ''}`} onClick={() => onLike(item.id)}>
          <HeartIcon /> {item.likeCount ?? 0}
        </button>
      </div>
    </div>
  );
}
