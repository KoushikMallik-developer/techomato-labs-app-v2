import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectIsSignedIn, selectUser } from '@/features/auth/authSlice';
import { addComment } from '../gallerySlice';

export default function CommentForm({ itemId }) {
  const isSignedIn = useSelector(selectIsSignedIn);
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [text, setText] = useState('');

  if (!isSignedIn) {
    return (
      <p className="small muted" style={{ marginTop: 10 }}>
        <Link to={`/login?next=${encodeURIComponent(`/community/${itemId}`)}`}>Log in</Link> to leave a comment.
      </p>
    );
  }

  if (!user.verified) {
    return (
      <p className="small muted" style={{ marginTop: 10 }}>
        <Link to={`/verify-email?next=${encodeURIComponent(`/community/${itemId}`)}`}>Verify your email</Link> to leave a
        comment.
      </p>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await dispatch(addComment({ itemId, text: text.trim() }));
    if (addComment.fulfilled.match(res)) setText(''); // on failure keep the text; the failure toast explains why
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
      <input
        className="input"
        placeholder="Add a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn primary" type="submit">
        Post
      </button>
    </form>
  );
}
