import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, updateProfile } from '@/features/auth/authSlice';
import { showToast } from '@/features/ui/uiSlice';

const AVATARS = ['\u{1F916}', '\u{1F9EA}', '⚡', '\u{1F527}', '\u{1F52C}', '\u{1F680}', '\u{1F9E9}', '\u{1F50C}', '\u{1F4A1}', '\u{1F5A5}️', '\u{1F41B}', '⚙️', '\u{1F30A}', '\u{1F525}', '\u{1F3AF}', '\u{1F30C}'];

export default function ProfilePanel() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [name, setName] = useState(user?.name || '');

  async function saveName(e) {
    e.preventDefault();
    const res = await dispatch(updateProfile({ name: name.trim() || user.name }));
    dispatch(showToast(updateProfile.fulfilled.match(res) ? 'Profile updated.' : res.error.message));
  }

  async function pickAvatar(a) {
    const res = await dispatch(updateProfile({ avatar: a }));
    if (!updateProfile.fulfilled.match(res)) dispatch(showToast(res.error.message));
  }

  return (
    <section className="panel glass">
      <h2>Profile</h2>
      <p>Your name and avatar, shown on anything you publish to Community Circuits.</p>
      {user && !user.verified && (
        <p className="form-error">
          Your email isn&apos;t verified yet. <Link to="/verify-email">Verify it</Link>
        </p>
      )}
      <form className="row" onSubmit={saveName}>
        <div className="field">
          <label htmlFor="settings-name">Name</label>
          <input id="settings-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn primary" type="submit">
          Save
        </button>
      </form>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            className={`avatar-opt${user?.avatar === a ? ' on' : ''}`}
            onClick={() => pickAvatar(a)}
            aria-label={`Use ${a} as avatar`}
          >
            {a}
          </button>
        ))}
      </div>
    </section>
  );
}
