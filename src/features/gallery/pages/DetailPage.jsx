import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Nav from '@/components/Nav';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import CommentList from '../components/CommentList';
import CommentForm from '../components/CommentForm';
import { fetchDetail, toggleLike, remixItem, selectGalleryState } from '../gallerySlice';
import { openModal } from '@/features/ui/uiSlice';
import { selectIsSignedIn, selectUser } from '@/features/auth/authSlice';
import { TYPES } from '@/features/editor/engine/constants';

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1 4 2.5C10.5 6 12 5 14 5c3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21z" />
    </svg>
  );
}

export default function DetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isSignedIn = useSelector(selectIsSignedIn);
  const user = useSelector(selectUser);
  const { detail: item, comments } = useSelector(selectGalleryState);

  useEffect(() => {
    dispatch(fetchDetail(id));
  }, [dispatch, id]);

  if (!item) {
    return (
      <div className="page">
        <Nav active="gallery" />
        <div className="container wrap">
          <p className="muted">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  const isOwner = user && item.ownerId === user.id;
  const partCounts = new Map();
  for (const p of item.parts) {
    if (p.type === 'breadboard' || p.type === 'arduino') continue;
    partCounts.set(p.type, (partCounts.get(p.type) || 0) + 1);
  }

  function onLike() {
    if (!isSignedIn) return navigate(`/login?next=${encodeURIComponent(`/community/${id}`)}`);
    dispatch(toggleLike(id));
  }

  async function onRemix() {
    if (!isSignedIn) return navigate(`/login?next=${encodeURIComponent(`/community/${id}`)}`);
    const res = await dispatch(remixItem(item));
    if (remixItem.fulfilled.match(res)) navigate(`/editor/${res.payload.id}`);
  }

  async function onCopyLink() {
    const url = `${window.location.origin}/community/${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <div className="page">
      <Nav active="gallery" />
      <div className="container wrap">
        <Link to="/community" className="back">
          &larr; Back to Community Circuits
        </Link>
        <div className="detail">
          <div className="preview glass">
            <div className="thumb">
              <CircuitThumbnail parts={item.parts} wires={item.wires} />
            </div>
          </div>
          <div className="info">
            <div className="tags">
              {item.tags?.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <h1>{item.name}</h1>
            <p className="small muted">
              by{' '}
              <button
                style={{ all: 'unset', color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => dispatch(openModal({ type: 'author', props: { handle: item.author } }))}
              >
                @{item.author}
              </button>
            </p>
            <div className="row">
              {isOwner ? (
                <Link to={`/editor/${item.id}`} className="btn primary">
                  Open in editor
                </Link>
              ) : (
                <button className="btn primary" onClick={onRemix}>
                  Open a copy
                </button>
              )}
              <button className={`like${item.liked ? ' on' : ''}`} onClick={onLike}>
                <HeartIcon /> {item.likeCount ?? 0}
              </button>
              <button className="btn" onClick={onCopyLink}>
                Copy link
              </button>
            </div>
            {item.description && <p className="desc">{item.description}</p>}
            <ul className="facts">
              {[...partCounts.entries()].map(([type, count]) => (
                <li key={type}>
                  {count}× {TYPES[type]?.label || type}
                </li>
              ))}
              <li>{item.wires.length} wires</li>
            </ul>
            <p className="sub">Sketch preview</p>
            <pre className="code-peek">{item.code.split('\n').slice(0, 40).join('\n')}</pre>
          </div>
        </div>
        <p className="sub">Comments</p>
        <CommentList itemId={id} comments={comments} />
        <CommentForm itemId={id} />
      </div>
    </div>
  );
}
