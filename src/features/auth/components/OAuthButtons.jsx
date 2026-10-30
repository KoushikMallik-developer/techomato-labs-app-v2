import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchOAuthProviders, oauthLogin, selectOAuthProviders, clearError } from '../authSlice';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.42-.22-2.05H12v3.9h6.55c-.13 1.06-.85 2.66-2.45 3.73l-.02.15 3.56 2.71.25.02c2.26-2.06 3.61-5.1 3.61-8.46z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.05 7.94-2.87l-3.79-2.88c-1.01.7-2.38 1.19-4.15 1.19-3.16 0-5.84-2.06-6.79-4.9l-.14.01-3.7 2.82-.05.13C3.28 21.44 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.21 14.54A7.4 7.4 0 0 1 4.8 12c0-.88.16-1.74.4-2.54L5.19 9.3l-3.75-2.9-.12.06A11.98 11.98 0 0 0 0 12c0 1.93.47 3.76 1.31 5.36l3.9-2.82z" />
      <path fill="#EA4335" d="M12 4.75c2.26 0 3.78.97 4.65 1.79l3.39-3.3C17.94 1.19 15.24 0 12 0 7.31 0 3.28 2.56 1.31 6.64l3.89 2.82C6.16 6.81 8.84 4.75 12 4.75z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.9c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.08.78 2.17v3.22c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

const PROVIDERS = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'github', label: 'GitHub', Icon: GithubIcon },
];

/** "Continue with Google/GitHub" — Firebase's popup sign-in. Buttons stay disabled
 * until the provider list loads (and while another auth request is running). */
export default function OAuthButtons({ next, disabled }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const providers = useSelector(selectOAuthProviders) || {};

  useEffect(() => {
    dispatch(fetchOAuthProviders());
  }, [dispatch]);

  async function onClick(provider) {
    dispatch(clearError());
    const res = await dispatch(oauthLogin({ provider: provider.id }));
    if (oauthLogin.fulfilled.match(res)) {
      navigate(res.payload.verified ? next : `/verify-email?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }

  return (
    <div className="oauth-row">
      {PROVIDERS.map((provider) => {
        const enabled = !!providers[provider.id];
        return (
          <button
            key={provider.id}
            type="button"
            className="btn block oauth-btn"
            onClick={() => onClick(provider)}
            disabled={disabled || !enabled}
            title={enabled ? undefined : `Sign in with ${provider.label} isn't enabled yet.`}
          >
            <provider.Icon />
            Continue with {provider.label}
          </button>
        );
      })}
    </div>
  );
}
