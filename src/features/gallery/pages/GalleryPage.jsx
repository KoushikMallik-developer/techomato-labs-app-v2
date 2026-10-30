import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import GalleryCard from '@/components/GalleryCard';
import { fetchGallery, setQuery, setTag, setSort, toggleLike, selectGalleryState } from '../gallerySlice';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { TAGS } from '@/lib/templates';

export default function GalleryPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isSignedIn = useSelector(selectIsSignedIn);
  const { items: visible, q, tag, sort, status } = useSelector(selectGalleryState);

  useEffect(() => {
    dispatch(fetchGallery());
  }, [dispatch, q, tag, sort]);

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

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search Community Circuits…"
          value={q}
          onChange={(e) => dispatch(setQuery(e.target.value))}
        />
        <select className="input" value={sort} onChange={(e) => dispatch(setSort(e.target.value))}>
          <option value="popular">Most liked</option>
          <option value="new">Newest</option>
        </select>
      </div>

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
    </AppShell>
  );
}
