import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { addComment } from '../gallerySlice';

export default function CommentForm({ itemId }) {
  const isSignedIn = useSelector(selectIsSignedIn);
  const dispatch = useDispatch();
  const [text, setText] = useState('');

  if (!isSignedIn) {
    return (
      <p className="small muted" style={{ marginTop: 10 }}>
        <Link to={`/login?next=${encodeURIComponent(`/community/${itemId}`)}`}>Log in</Link> to leave a comment.
      </p>
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch(addComment({ itemId, text: text.trim() }));
    setText('');
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
