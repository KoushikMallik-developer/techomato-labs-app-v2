import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { selectIsSignedIn, selectUser } from '@/features/auth/authSlice';
import { selectIsAdmin } from '@/features/admin/adminSlice';
import { openModal, showToast } from '@/features/ui/uiSlice';

function ReplyForm({ onSend, placeholder, autoFocus }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    if (await onSend(text)) setText(''); // keep the text if it failed, so nothing typed is lost
    setBusy(false);
  }

  return (
    <form className="row" style={{ gap: 8, margin: '8px 0' }} onSubmit={onSubmit}>
      <input
        className="input"
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={2000}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn" disabled={busy || !text.trim()}>
        Send
      </button>
    </form>
  );
}

/** One discussion: the post, its comments, and one level of replies under each comment. */
export default function ThreadPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isSignedIn = useSelector(selectIsSignedIn);
  const user = useSelector(selectUser);
  const isAdmin = useSelector(selectIsAdmin);
  const [thread, setThread] = useState(undefined);
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    api.thread(id).then(setThread, () => setThread(null));
  }, [id]);

  const signInFirst = () => navigate(`/login?next=${encodeURIComponent(`/discussions/${id}`)}`);
  const canDelete = (item) => isAdmin || (user && item.userId === user.id);

  async function send(text, parentId = null) {
    try {
      const post = await api.addPost(id, text, parentId);
      setThread((t) => ({ ...t, posts: [...t.posts, post] }));
      setReplyTo(null);
      return true;
    } catch (err) {
      dispatch(showToast(err.message));
      return false;
    }
  }

  async function toggleLike(postId) {
    if (!isSignedIn) return signInFirst();
    const target = postId ? thread.posts.find((p) => p.id === postId) : thread;
    const flip = (x) => ({ ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) });
    try {
      await api.setDiscussionLike(id, postId, !target.liked);
      setThread((t) => (postId ? { ...t, posts: t.posts.map((p) => (p.id === postId ? flip(p) : p)) } : flip(t)));
    } catch (err) {
      dispatch(showToast(err.message));
    }
  }

  function report(item, postId) {
    if (!isSignedIn) return signInFirst();
    // One report per person per discussion (the rules key it on the discussion), so a comment is named in the text.
    const note = postId ? `Comment by @${item.author} "${item.text.slice(0, 80)}": ` : '';
    dispatch(openModal({ type: 'report', props: { item: { id: `thread:${id}`, name: thread.title }, note } }));
  }

  function confirmDelete(postId) {
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: postId ? 'Delete this comment?' : 'Delete this discussion?',
          body: 'This cannot be undone.',
          onConfirm: async () => {
            try {
              if (postId) {
                await api.deletePost(id, postId);
                setThread((t) => ({ ...t, posts: t.posts.filter((p) => p.id !== postId) }));
              } else {
                await api.deleteThread(id);
                navigate('/discussions');
              }
            } catch (err) {
              dispatch(showToast(err.message));
            }
          },
        },
      }),
    );
  }

  if (thread === undefined) {
    return (
      <AppShell title="Discussion">
        <p className="muted">Loading&hellip;</p>
      </AppShell>
    );
  }
  if (thread === null) {
    return (
      <AppShell title="Discussion">
        <p className="muted">This discussion was removed or never existed.</p>
        <Link to="/discussions" className="btn">
          Back to Discussions
        </Link>
      </AppShell>
    );
  }

  const ids = new Set(thread.posts.map((p) => p.id));
  // A reply whose comment was deleted is shown on its own, so its author can still see and delete it.
  const comments = thread.posts.filter((p) => !p.parentId || !ids.has(p.parentId));
  const repliesOf = (cid) => thread.posts.filter((p) => p.parentId === cid);

  const actions = (item, postId) => (
    <span className="row small" style={{ gap: 10 }}>
      <button className={`like${item.liked ? ' on' : ''}`} onClick={() => toggleLike(postId)} aria-pressed={item.liked}>
        ♥ {item.likeCount}
      </button>
      {postId && !item.parentId && (
        <button className="editor-link" onClick={() => (isSignedIn ? setReplyTo(postId) : signInFirst())}>
          Reply
        </button>
      )}
      {canDelete(item) && (
        <button className="editor-link" onClick={() => confirmDelete(postId)}>
          Delete
        </button>
      )}
      {(!user || item.userId !== user.id) && (
        <button className="editor-link" onClick={() => report(item, postId)}>
          Report
        </button>
      )}
    </span>
  );

  const byline = (item) => (
    <span className="small muted">
      <Link to={`/u/${item.author}`}>@{item.author}</Link> · {new Date(item.createdAt).toLocaleString()}
    </span>
  );

  return (
    <AppShell title="Discussion">
      <Link to="/discussions" className="back">
        &larr; Back to Discussions
      </Link>
      <article className="glass" style={{ padding: 18, borderRadius: 'var(--r-md)', margin: '12px 0 20px' }}>
        <h2 style={{ marginTop: 0 }}>{thread.title}</h2>
        {byline(thread)}
        <p className="thread-body">{thread.body}</p>
        {actions(thread, null)}
      </article>

      <p className="sub">
        {comments.length} comments
      </p>
      {comments.map((c) => (
        <div key={c.id} className="post">
          {byline(c)}
          <p className="post-text">{c.text}</p>
          {actions(c, c.id)}
          <div className="post-replies">
            {repliesOf(c.id).map((r) => (
              <div key={r.id} className="post">
                {byline(r)}
                <p className="post-text">{r.text}</p>
                {actions(r, r.id)}
              </div>
            ))}
            {replyTo === c.id && (
              <ReplyForm placeholder={`Reply to @${c.author}`} autoFocus onSend={(text) => send(text, c.id)} />
            )}
          </div>
        </div>
      ))}
      {isSignedIn ? (
        <ReplyForm placeholder="Write a comment" onSend={(text) => send(text)} />
      ) : (
        <button className="btn" onClick={signInFirst}>
          Log in to comment
        </button>
      )}
    </AppShell>
  );
}
