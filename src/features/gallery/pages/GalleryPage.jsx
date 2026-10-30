import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import GalleryCard from '@/components/GalleryCard';
import { fetchGallery, searchGallery, setQuery, setTag, setSort, toggleLike, selectGalleryState } from '../gallerySlice';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { TAGS } from '@/lib/templates';

export default function GalleryPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isSignedIn = useSelector(selectIsSignedIn);
  const { items: loaded, q, tag, sort, status, cursor } = useSelector(selectGalleryState);

  // Search and sort work on what is already loaded, so typing never costs Firestore reads.
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return loaded
      .filter((p) => !needle || `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'new' ? 0 : b.likeCount - a.likeCount) || b.publishedAt - a.publishedAt);
  }, [loaded, q, sort]);

  useEffect(() => {
    dispatch(fetchGallery());
  }, [dispatch, tag]);

  // Typing filters what is loaded (free); Enter searches every shared circuit by name (one query).
  const searched = useRef(false);
  function onSearch(e) {
    e.preventDefault();
    searched.current = !!q.trim();
    dispatch(q.trim() ? searchGallery(q) : fetchGallery());
  }

  function onType(value) {
    dispatch(setQuery(value));
    // Emptying the box after a server search must bring the normal pages back, not leave the results.
    if (!value.trim() && searched.current) {
      searched.current = false;
      dispatch(fetchGallery());
    }
  }

  function onLike(id) {
    if (!isSignedIn) {
      navigate(`/login?next=${encodeURIComponent('/community')}`);
      return;
    }
    dispatch(toggleLike(id));
  }

  return (
    <AppShell title="Community Circuits">
      <div className="head">
        <div>
          <p>Circuits shared by the community.</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={onSearch} role="search">
        <input
          className="input"
          placeholder="Search Community Circuits… (Enter searches all)"
          aria-label="Search Community Circuits"
          value={q}
          onChange={(e) => onType(e.target.value)}
        />
        <select className="input" value={sort} onChange={(e) => dispatch(setSort(e.target.value))}>
          <option value="popular">Most liked</option>
          <option value="new">Newest</option>
        </select>
      </form>

      <div className="fchips" style={{ marginBottom: 20 }}>
        <button className={`fchip${!tag ? ' on' : ''}`} onClick={() => dispatch(setTag(''))}>
          All
        </button>
        {isSignedIn && (
          <button
            className={`fchip${tag === '__following__' ? ' on' : ''}`}
            onClick={() => dispatch(setTag('__following__'))}
          >
            Following
          </button>
        )}
        {TAGS.map((t) => (
          <button key={t} className={`fchip${tag === t ? ' on' : ''}`} onClick={() => dispatch(setTag(t))}>
            {t}
          </button>
        ))}
      </div>

      {status === 'loading' && visible.length === 0 ? (
        <p className="muted">Loading&hellip;</p>
      ) : visible.length === 0 ? (
        <div className="empty glass">
          <h2>Nothing here yet</h2>
          <p className="muted">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="cards">
          {visible.map((item) => (
            <GalleryCard key={item.id} item={item} liked={item.liked} onLike={onLike} />
          ))}
        </div>
      )}
      {cursor != null && (
        <button className="btn" disabled={status === 'loading'} onClick={() => dispatch(fetchGallery(true))}>
          Load more
        </button>
      )}
    </AppShell>
  );
}
