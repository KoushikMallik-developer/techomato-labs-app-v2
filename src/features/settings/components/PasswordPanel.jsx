import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { changePassword } from '@/features/auth/authSlice';
import { showToast } from '@/features/ui/uiSlice';

export default function PasswordPanel() {
  const dispatch = useDispatch();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const res = await dispatch(changePassword({ current, next }));
    if (changePassword.fulfilled.match(res)) {
      setCurrent('');
      setNext('');
      dispatch(showToast('Password updated.'));
    } else {
      setError(res.error.message);
    }
  }

  return (
    <section className="panel glass">
      <h2>Password</h2>
      <p>Change the password used to log in on this device.</p>
      <form onSubmit={onSubmit}>
        <div className="row">
          <div className="field">
            <label htmlFor="current-pass">Current password</label>
            <input
              id="current-pass"
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="next-pass">New password</label>
            <input
              id="next-pass"
              className="input"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <button className="btn primary" type="submit">
            Update
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </section>
  );
}
