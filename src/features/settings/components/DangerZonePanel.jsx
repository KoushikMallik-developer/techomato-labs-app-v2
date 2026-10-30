import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { openModal } from '@/features/ui/uiSlice';
import { deleteAccount, logout } from '@/features/auth/authSlice';

export default function DangerZonePanel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  function onDelete() {
    dispatch(
      openModal({
        type: 'confirm',
        props: {
          title: 'Delete your account?',
          body: 'This permanently deletes your account, projects, and folders. This cannot be undone.',
          confirmLabel: 'Delete account',
          onConfirm: async () => {
            await dispatch(deleteAccount());
            navigate('/');
          },
        },
      }),
    );
  }

  async function onSignOut() {
    // Navigating before the thunk resolves can leave RequireAuth's guarded
    // route to react to the delayed state change and bounce back to /login,
    // so wait for the session to actually clear first.
    await dispatch(logout());
    navigate('/');
  }

  return (
    <>
      <section className="panel glass">
        <h2>Your data</h2>
        <p>Sign out to switch accounts.</p>
        <div className="row">
          <button className="btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </section>
      <section className="panel glass danger-zone">
        <h2>Danger zone</h2>
        <p>Delete your account and everything you&apos;ve built.</p>
        <div className="row">
          <button className="btn danger" onClick={onDelete}>
            Delete account
          </button>
        </div>
      </section>
    </>
  );
}
