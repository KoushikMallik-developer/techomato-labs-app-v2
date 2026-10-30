import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import CircuitThumbnail from '@/components/CircuitThumbnail';
import BrandMark from '@/components/BrandMark';
import { openModal } from '@/features/ui/uiSlice';
import ReportsSection from '../components/ReportsSection';
import {
  fetchPending,
  fetchUsers,
  approveCircuit,
  rejectCircuit,
  setUserDisabled,
  adminLogout,
  selectPendingCircuits,
  selectAdminUsers,
  selectUsersCursor,
} from '../adminSlice';

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export default function AdminPanelPage() {
  const dispatch = useDispatch();
  const pending = useSelector(selectPendingCircuits);
  const users = useSelector(selectAdminUsers);
  const usersCursor = useSelector(selectUsersCursor);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchPending());
    dispatch(fetchUsers());
  }, [dispatch]);

  function onSearch(e) {
    e.preventDefault();
    dispatch(fetchUsers({ q: search.trim() }));
  }

  function onToggleUser(user) {
    if (user.disabled) return dispatch(setUserDisabled({ id: user.id, disabled: false }));
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: `Disable @${user.handle}?`,
          body: 'They can still look around, but cannot comment, like, create, edit or share circuits until you enable the account again. Circuits that are already public stay up.',
          confirmLabel: 'Disable account',
          onConfirm: () => dispatch(setUserDisabled({ id: user.id, disabled: true })),
        },
      }),
    );
  }

  return (
    <div className="page">
      <header className="nav">
        <div className="container nav-in">
          <Link to="/" className="brand">
            <BrandMark />
            <b>Techomato Labs</b>
            <span className="badge" style={{ marginLeft: 4 }}>
              Admin
            </span>
          </Link>
          <div className="nav-right">
            <button className="btn" onClick={() => dispatch(adminLogout())}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="container wrap">
        <div className="head">
          <div>
            <h1>Pending approval</h1>
            <p>Circuits submitted to Community Circuits, waiting for review.</p>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="empty glass">
            <h2>Nothing to review</h2>
            <p className="muted">New submissions will show up here.</p>
          </div>
        ) : (
          <div className="cards">
            {pending.map((item) => (
              <div className="pcard glass" key={item.id}>
                <div className="thumb">
                  <CircuitThumbnail parts={item.parts} wires={item.wires} />
                </div>
                <div className="pcard-body">
                  <span className="pname">{item.name}</span>
                  <span className="small muted">
                    by @{item.author} · submitted {timeAgo(item.publishedAt || item.updatedAt)}
                  </span>
                  {item.description && <p className="small muted">{item.description}</p>}
                  {item.tags?.length > 0 && (
                    <div className="tags">
                      {item.tags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pcard-foot" style={{ gap: 8 }}>
                  <button className="btn danger" onClick={() => dispatch(rejectCircuit(item.id))}>
                    Reject
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => dispatch(approveCircuit({ id: item.id, seen: item.updatedAt }))}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ReportsSection />

        <div className="head" style={{ marginTop: 40 }}>
          <div>
            <h1>Users</h1>
            <p>Newest first. A disabled account can browse but cannot write anything.</p>
          </div>
        </div>
        <form className="row" onSubmit={onSearch} style={{ marginBottom: 12 }}>
          <input
            className="input"
            placeholder="Search by name, email or handle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
        <div className="action-list">
          {users.length === 0 && <p className="muted small">No users to show.</p>}
          {users.map((u) => (
            <div
              key={u.id}
              className="row"
              style={{ justifyContent: 'space-between', gap: 12, margin: '6px 0' }}
            >
              <span>
                {u.name} <span className="muted small">@{u.handle}</span>
                {u.disabled && (
                  <span className="badge" style={{ marginLeft: 8 }}>
                    Disabled
                  </span>
                )}
                <br />
                <span className="muted small">
                  {u.email || 'no email on file'} · joined{' '}
                  {u.createdAt ? timeAgo(u.createdAt) : 'a while ago'} · {u.circuits} circuits
                  ·{' '}
                </span>
                {u.community > 0 ? (
                  <button
                    className="btn small"
                    onClick={() =>
                      dispatch(openModal({ type: 'user-circuits', props: { user: u } }))
                    }
                  >
                    {u.community} in Community
                  </button>
                ) : (
                  <span className="muted small">0 in Community</span>
                )}
              </span>
              <button
                className={`btn${u.disabled ? '' : ' danger'}`}
                onClick={() => onToggleUser(u)}
              >
                {u.disabled ? 'Enable' : 'Disable'}
              </button>
            </div>
          ))}
        </div>
        {usersCursor != null && (
          <button className="btn" onClick={() => dispatch(fetchUsers({ more: true }))}>
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
