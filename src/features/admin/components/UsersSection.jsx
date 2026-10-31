import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { openModal } from '@/features/ui/uiSlice';
import {
  fetchUsers,
  setUserDisabled,
  selectAdminLoaded,
  selectAdminUsers,
  selectUsersCursor,
} from '../adminSlice';
import { timeAgo } from '../timeAgo';

/** Everyone who signed up, newest first, with search. A disabled account can browse but not write. */
export default function UsersSection() {
  const dispatch = useDispatch();
  const users = useSelector(selectAdminUsers);
  const cursor = useSelector(selectUsersCursor);
  const loaded = useSelector(selectAdminLoaded).users;
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  function onSearch(e) {
    e.preventDefault();
    dispatch(fetchUsers({ q: search.trim() }));
  }

  function onToggle(user) {
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
    <>
      <form className="toolbar" onSubmit={onSearch}>
        <input
          className="input"
          placeholder="Search by name, email or handle…"
          aria-label="Search users"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      {loaded && users.length === 0 && <p className="muted">No users to show.</p>}
      <div className="adm-list">
        {users.map((u) => (
          <div key={u.id} className="adm-row glass adm-user">
            <span className="adm-avatar" aria-hidden="true">
              {(u.name || u.handle || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="adm-user-main">
              <b>
                {u.name} <span className="muted small">@{u.handle}</span>
                {u.disabled && <span className="badge off">Disabled</span>}
              </b>
              <span className="muted small">
                {u.email || 'no email on file'} · joined{' '}
                {u.createdAt ? timeAgo(u.createdAt) : 'a while ago'} · {u.circuits} circuits
              </span>
            </div>
            {u.community > 0 ? (
              <button
                className="btn small"
                onClick={() => dispatch(openModal({ type: 'user-circuits', props: { user: u } }))}
              >
                {u.community} in Community
              </button>
            ) : (
              <span className="muted small">0 in Community</span>
            )}
            <button className={`btn${u.disabled ? '' : ' danger'}`} onClick={() => onToggle(u)}>
              {u.disabled ? 'Enable' : 'Disable'}
            </button>
          </div>
        ))}
      </div>
      {cursor != null && (
        <button
          className="btn"
          style={{ marginTop: 14 }}
          onClick={() => dispatch(fetchUsers({ more: true }))}
        >
          Load more
        </button>
      )}
    </>
  );
}
