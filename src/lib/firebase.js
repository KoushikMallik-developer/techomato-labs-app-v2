import { initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const missing = ['API_KEY', 'PROJECT_ID', 'APP_ID'].filter((k) => !import.meta.env[`VITE_FIREBASE_${k}`]);
if (missing.length) {
  throw new Error(`Missing Firebase settings: ${missing.map((k) => `VITE_FIREBASE_${k}`).join(', ')}. See .env.example.`);
}

// These values are public by design; Firestore security rules (firestore.rules) are what protect the data.
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

// App Check makes Firebase reject traffic that did not come from this site. It is on only when
// VITE_RECAPTCHA_SITE_KEY is set to a non-blank value; leave it unset or blank to turn it off.
const recaptchaKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
if (recaptchaKey) {
  // Local development has no real reCAPTCHA token: the console prints a debug token to register in Firebase.
  if (import.meta.env.DEV) globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaKey), isTokenAutoRefreshEnabled: true });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
