import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { selectIsSignedIn } from '@/features/auth/authSlice';
import { showToast } from '@/features/ui/uiSlice';

/** Discussions: posts anyone can read; signed-in, verified users start them and reply. */
export default function DiscussionsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isSignedIn = useSelector(selectIsSignedIn);
  const [threads, setThreads] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.threads().then(
      (r) => {
        setThreads(r.items);
        setCursor(r.cursor);
      },
      () => setThreads([]),
    );
  }, []);

  async function onMore() {
    const r = await api.threads({ after: cursor });
    setThreads((list) => [...list, ...r.items]);
    setCursor(r.cursor);
  }

  function onNew() {
    if (!isSignedIn) return navigate(`/login?next=${encodeURIComponent('/discussions')}`);
    setComposing(true);
  }

  async function onPost(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const thread = await api.createThread({ title, body });
      navigate(`/discussions/${thread.id}`);
    } catch (err) {
      dispatch(showToast(err.message));
      setBusy(false);
    }
  }

  return (
    <AppShell title="Discussions">
      <div className="head">
        <div>
          <p>Ask for help, show off a build, or talk circuits with the community.</p>
        </div>
        {!composing && (
          <button className="btn primary" onClick={onNew}>
            New post
          </button>
        )}
      </div>

      {composing && (
        <form className="glass" style={{ padding: 16, borderRadius: 'var(--r-md)', marginBottom: 20 }} onSubmit={onPost}>
          <div className="field">
            <label htmlFor="thread-title">Title</label>
            <input
              id="thread-title"
              className="input"
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="thread-body">Post</label>
            <textarea
              id="thread-body"
              className="input"
              rows={6}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Posting…' : 'Post'}
            </button>
            <button type="button" className="btn" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {threads === null ? (
        <p className="muted">Loading&hellip;</p>
      ) : threads.length === 0 ? (
        <div className="empty glass">
          <h2>No discussions yet</h2>
          <p className="muted">Start the first one.</p>
        </div>
      ) : (
        <div className="thread-list">
          {threads.map((t) => (
            <Link key={t.id} to={`/discussions/${t.id}`} className="thread-card glass">
              <h3>{t.title}</h3>
              <span className="small muted">
                @{t.author} · {new Date(t.createdAt).toLocaleDateString()} · {t.likeCount} likes
              </span>
            </Link>
          ))}
        </div>
      )}
      {cursor != null && (
        <button className="btn" style={{ marginTop: 16 }} onClick={onMore}>
          Load more
        </button>
      )}
    </AppShell>
  );
}
