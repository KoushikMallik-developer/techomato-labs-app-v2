import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFollowing, toggleFollow, selectFollowing } from '@/features/gallery/gallerySlice';

export default function FollowingPanel() {
  const dispatch = useDispatch();
  const handles = useSelector(selectFollowing);

  useEffect(() => {
    dispatch(fetchFollowing());
  }, [dispatch]);

  function unfollow(handle) {
    dispatch(toggleFollow(handle));
  }

  return (
    <section className="panel glass">
      <h2>People you follow</h2>
      <p>{handles.length === 0 ? "You aren't following anyone yet — find makers in Community Circuits." : ''}</p>
      {handles.length > 0 && (
        <div className="action-list">
          {handles.map((h) => (
            <div key={h} className="row" style={{ justifyContent: 'space-between' }}>
              <span>@{h}</span>
              <button className="btn" onClick={() => unfollow(h)}>
                Unfollow
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
