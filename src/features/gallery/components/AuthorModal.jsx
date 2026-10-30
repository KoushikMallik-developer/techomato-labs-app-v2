import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '@/lib/api';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { fetchFollowing, toggleFollow, selectIsFollowing } from '../gallerySlice';

export default function AuthorModal({ handle, close }) {
  const [items, setItems] = useState([]);
  const dispatch = useDispatch();
  const isSignedIn = useSelector(selectIsSignedIn);
  const following = useSelector(selectIsFollowing(handle));

  useEffect(() => {
    api.gallery({ author: handle }).then((r) => setItems(r.items));
  }, [handle]);

  useEffect(() => {
    if (isSignedIn) dispatch(fetchFollowing());
  }, [dispatch, isSignedIn]);

  function toggle() {
    dispatch(toggleFollow(handle));
  }

  return (
    <>
      <h2>@{handle}</h2>
      {isSignedIn && (
        <button className={`btn${following ? '' : ' primary'}`} onClick={toggle} style={{ marginTop: 10 }}>
          {following ? 'Following' : 'Follow'}
        </button>
      )}
      <p className="sub">Shared circuits</p>
      <div className="action-list">
        {items.map((i) => (
          <Link key={i.id} to={`/community/${i.id}`} onClick={close}>
            {i.name}
          </Link>
        ))}
        {items.length === 0 && <p className="muted small">Nothing shared yet.</p>}
      </div>
      <div className="modal-actions">
        <Link className="btn" to={`/u/${handle}`} onClick={close}>
          View profile
        </Link>
        <button className="btn" onClick={close}>
          Close
        </button>
      </div>
    </>
  );
}
