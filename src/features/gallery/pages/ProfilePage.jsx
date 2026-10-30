import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AppShell from '@/components/AppShell';
import GalleryCard from '@/components/GalleryCard';
import { api } from '@/lib/api';
import { selectIsSignedIn, selectUser } from '@/features/auth/authSlice';
import { fetchFollowing, toggleFollow, selectIsFollowing } from '../gallerySlice';

/** /u/:handle, the public page of an author: their shared circuits, a like total and a follow button. */
export default function ProfilePage() {
  const { handle } = useParams();
  const dispatch = useDispatch();
  const isSignedIn = useSelector(selectIsSignedIn);
  const user = useSelector(selectUser);
  const following = useSelector(selectIsFollowing(handle));
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);

  useEffect(() => {
    setItems(null);
    api.gallery({ author: handle }).then(
      (r) => {
        setItems(r.items);
        setCursor(r.cursor);
      },
      () => setItems([]),
    );
  }, [handle]);

  useEffect(() => {
    if (isSignedIn) dispatch(fetchFollowing());
  }, [dispatch, isSignedIn]);

  async function onMore() {
    const r = await api.gallery({ author: handle, after: cursor });
    setItems((list) => [...list, ...r.items]);
    setCursor(r.cursor);
  }

  const likes = (items || []).reduce((sum, i) => sum + (i.likeCount || 0), 0);

  return (
    <AppShell title={`@${handle}`}>
      <div className="head">
        <div>
          <p>
            {items ? `${items.length}${cursor != null ? '+' : ''} shared circuits · ${likes} likes` : 'Loading…'}
          </p>
        </div>
        {isSignedIn && user?.handle !== handle && (
          <button className={`btn${following ? '' : ' primary'}`} onClick={() => dispatch(toggleFollow(handle))}>
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
      {items?.length === 0 && (
        <div className="empty glass">
          <h2>No shared circuits</h2>
          <p className="muted">@{handle} has not shared anything to Community Circuits yet.</p>
        </div>
      )}
      {items?.length > 0 && (
        <div className="cards">
          {items.map((item) => (
            <GalleryCard key={item.id} item={item} liked={item.liked} />
          ))}
        </div>
      )}
      {cursor != null && (
        <button className="btn" onClick={onMore}>
          Load more
        </button>
      )}
    </AppShell>
  );
}
