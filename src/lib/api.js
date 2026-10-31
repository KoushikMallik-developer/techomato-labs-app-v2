/**
 * Firebase data layer (Auth + Firestore). Same public surface as the old REST
 * client so Redux thunks and components are untouched. There is no server:
 * everything here runs in the browser and is enforced by firestore.rules.
 *
 * Failures are thrown as Errors with a friendly `.message` and a `.code`.
 */
import {
  EmailAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  linkWithCredential,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getCountFromServer,
  getDoc,
  getDocs,
  arrayRemove,
  arrayUnion,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  startAt,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { sanitizeCircuit } from '@/lib/sanitizeCircuit';
import { MAX_BOOKMARKS, MAX_FOLDERS, MAX_FOLLOWS, MAX_PROJECTS, REPORTS_SHOWN } from '@/lib/limits';
import { buildTemplate } from '@/lib/templates';
import { getSamples, getSample, isSampleId, SAMPLE_AUTHOR } from '@/lib/samples';

// firestore.rules' lower() only lowercases A-Z, so the stored search copies must too ("Élan" -> "Élan").
const lowerAscii = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

const MAX_TAGS = 10;
const TAG_RE = /^[a-z0-9][a-z0-9 _-]{0,31}$/;
const HANDLE_RE = /^[A-Za-z0-9_]{1,64}$/;
const GALLERY_PAGE = 10;
const COMMENTS_SHOWN = 50;
const USERS_PAGE = 20;
const SEARCH_SHOWN = 24;
const THREADS_PAGE = 15;
const POSTS_SHOWN = 100; // the rules' list limit for a thread's posts
const NOTIFICATIONS_SHOWN = 30;
const LIST_LIMIT = 100; // the rules refuse project lists without a limit of at most 100
const FOLLOWING_FILTER = '__following__';
const STARTER_TEMPLATE = 'parking';
const DEFAULT_TEMPLATE = 'blank';
const PROVIDERS = { google: () => new GoogleAuthProvider(), github: () => new GithubAuthProvider() };
const PROVIDER_IDS = { 'google.com': 'google', 'github.com': 'github' };

const NETWORK = 'Could not reach the server. Check your connection and try again.';
const BAD_LOGIN = 'Email or password is incorrect.';
const RECENT_LOGIN = 'For security, log out and back in, then try again.';
const AUTH_ERRORS = {
  'auth/invalid-credential': [BAD_LOGIN, 'invalid_credentials'],
  'auth/wrong-password': [BAD_LOGIN, 'invalid_credentials'],
  'auth/user-not-found': [BAD_LOGIN, 'invalid_credentials'],
  'auth/email-already-in-use': ['An account with that email already exists.', 'validation_error'],
  'auth/invalid-email': ['Enter a valid email address.', 'validation_error'],
  'auth/weak-password': ['Password must be at least 8 characters.', 'validation_error'],
  'auth/too-many-requests': ['Too many attempts. Please wait a moment and try again.', 'throttled'],
  'auth/network-request-failed': [NETWORK, 'network'],
  'auth/invalid-action-code': ['That link is invalid or already used.', 'invalid_token'],
  'auth/expired-action-code': ['That link is invalid or has expired.', 'invalid_token'],
  'auth/popup-closed-by-user': ['Sign-in was cancelled.', 'oauth_failed'],
  'auth/cancelled-popup-request': ['Sign-in was cancelled.', 'oauth_failed'],
  'auth/popup-blocked': ['Your browser blocked the sign-in popup. Allow popups and try again.', 'oauth_failed'],
  'auth/account-exists-with-different-credential': [
    'An account with that email already exists. Log in with your password first.',
    'oauth_failed',
  ],
  'auth/requires-recent-login': [RECENT_LOGIN, 'recent_login'],
};

function fail(message, code = 'error') {
  return Object.assign(new Error(message), { code });
}

function mapError(e) {
  const known = AUTH_ERRORS[e.code];
  if (known) return fail(known[0], known[1]);
  if (e.code === 'permission-denied') return fail('You are not allowed to do that.', 'forbidden');
  if (e.code === 'unavailable') return fail(NETWORK, 'network');
  // Daily free quota used up: say so plainly instead of showing "Quota exceeded."
  if (e.code === 'resource-exhausted') return fail('The service is busy right now. Please try again in a little while.', 'busy');
  // Any other Firebase error (missing index, bad config, ...) is for you, not the user: log it, show something calm.
  if (e.name === 'FirebaseError') {
    console.error(e);
    return fail('Something went wrong. Please try again.', 'error');
  }
  return e;
}

/** Wraps a public method so Firebase errors surface with friendly messages. */
const wrap = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (e) {
    throw mapError(e);
  }
};

function uid() {
  if (!auth.currentUser) throw fail('Log in to continue.', 'not_authenticated');
  return auth.currentUser.uid;
}

const ref = (...path) => doc(db, ...path);
const now = () => Date.now();

// ---- users ----

function makeHandleBase(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'user';
}

async function loadUser(fbUser) {
  // The rules already stop a disabled account from writing; this also stops it signing in.
  if ((await getDoc(ref('disabledUsers', fbUser.uid))).exists()) {
    await signOut(auth);
    throw fail('This account has been disabled.', 'account_disabled');
  }
  const snap = await getDoc(ref('users', fbUser.uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const providerIds = fbUser.providerData.map((p) => p.providerId);
  return {
    id: fbUser.uid,
    name: d.name,
    email: fbUser.email || '',
    handle: d.handle,
    avatar: d.avatar || '',
    verified: fbUser.emailVerified,
    providers: providerIds.map((p) => PROVIDER_IDS[p]).filter(Boolean).sort(),
    hasPassword: providerIds.includes('password'),
    createdAt: d.createdAt,
  };
}

// Transient simulator state that must never be persisted with a circuit.
const cleanParts = (parts) => parts.map(({ pressed: _pressed, triggered: _triggered, ...rest }) => rest);

// parts/wires are stored as JSON strings: Firestore rejects nested arrays and `undefined`.
function newProjectDoc(ownerId, author, { name, parts, wires, code }, t = now()) {
  const cleanName = (name || '').trim().slice(0, 120) || 'Untitled circuit';
  return {
    ownerId,
    author,
    name: cleanName,
    nameLower: lowerAscii(cleanName), // for the Community search (prefix match)
    description: '',
    tags: [],
    folder: null,
    parts: JSON.stringify(cleanParts(parts || [])),
    wires: JSON.stringify(wires || []),
    code: code || '',
    published: false,
    approved: false,
    seed: false,
    likeCount: 0,
    publishedAt: null,
    approvedAt: null,
    createdAt: t,
    updatedAt: t,
  };
}

// Rules cannot check every field's type, so a hostile document may hold anything; read it defensively
// (an object in `tags` or broken JSON in `parts` would otherwise crash every page that lists it).
const ms = (v) => v?.toMillis?.() ?? (Number.isFinite(v) ? v : 0);
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
function parseList(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function projectFrom(snap) {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    name: text(d.name, 120),
    description: text(d.description, 2000),
    author: text(d.author, 64),
    tags: (Array.isArray(d.tags) ? d.tags : []).filter((t) => typeof t === 'string').slice(0, MAX_TAGS),
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt),
    publishedAt: ms(d.publishedAt),
    ...sanitizeCircuit(parseList(d.parts), parseList(d.wires)),
  };
}

/** Creates the profile, a unique @handle and the starter circuit in one atomic batch. */
async function createProfile(fbUser, name) {
  const cleanName = (name || '').trim().slice(0, 120) || 'Maker';
  const base = makeHandleBase(cleanName);
  const suffix = fbUser.uid.toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = now();
  const starter = { ...buildTemplate(STARTER_TEMPLATE), name: 'My first circuit' };
  let lastError;
  // Start with a short id suffix and widen it if the handle is taken.
  for (const size of [4, 6, 8, 12, suffix.length]) {
    const handle = `${base}_${suffix.slice(-size)}`;
    const batch = writeBatch(db);
    batch.set(ref('handles', handle), { uid: fbUser.uid });
    const profile = { name: cleanName, nameLower: lowerAscii(cleanName), handle, avatar: '', createdAt: t };
    batch.set(ref('users', fbUser.uid), { ...profile, email: lowerAscii(fbUser.email || '') });
    const starterRef = doc(collection(db, 'projects'));
    batch.set(starterRef, newProjectDoc(fbUser.uid, handle, starter, t));
    batch.set(ref('limits', fbUser.uid), { project: serverTimestamp(), projectId: starterRef.id, projectCount: increment(1) }, { merge: true });
    try {
      await batch.commit();
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

async function ownProject(id) {
  const snap = await getDoc(ref('projects', id));
  if (!snap.exists() || snap.data().ownerId !== uid()) throw fail('Project not found.', 'not_found');
  return snap;
}

async function profile() {
  const snap = await getDoc(ref('users', uid()));
  if (!snap.exists()) throw fail('Profile not found.', 'not_found');
  return snap.data();
}

// The rules refuse a create that does not stamp `limits/{uid}`, and refuse the stamp during the cooldown.
const slowDown = (e) =>
  e.code === 'permission-denied' ? fail('You are going too fast. Wait a few seconds and try again.', 'throttled') : e;

async function addProject(source) {
  const { handle } = await profile();
  const data = newProjectDoc(uid(), handle, source);
  // Same caps as validProject in firestore.rules, so a too-big file gets an honest message.
  if (data.parts.length > 400000 || data.wires.length > 400000 || data.code.length > 200000) {
    throw fail('That circuit is too large.', 'validation_error');
  }
  // Same number the rules enforce (limits/{uid}.projectCount), so the message and the rule cannot disagree.
  const used = (await getDoc(ref('limits', uid()))).data()?.projectCount ?? 0;
  if (used >= MAX_PROJECTS) {
    throw fail(`You can keep up to ${MAX_PROJECTS} circuits. Delete one to make room.`, 'limit_reached');
  }
  const projectRef = doc(collection(db, 'projects'));
  const batch = writeBatch(db);
  batch.set(projectRef, data);
  batch.set(
    ref('limits', uid()),
    { project: serverTimestamp(), projectId: projectRef.id, projectCount: increment(1) },
    { merge: true },
  );
  await batch.commit().catch((e) => {
    throw slowDown(e);
  });
  return projectFrom(await getDoc(projectRef));
}

async function deleteAll(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/** Commenting and sharing need a verified email. The user may have just clicked the link, so ask Firebase again
 * (and refresh the login token, which the rules read) before refusing. */
async function requireVerified() {
  const user = auth.currentUser;
  if (!user) throw fail('Log in to continue.', 'not_authenticated');
  if (!user.emailVerified) {
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
  }
  if (!user.emailVerified) throw fail('Verify your email first. Check your inbox for the link.', 'unverified');
}

function validPassword(password) {
  if (!password || password.length < 8) throw fail('Password must be at least 8 characters.', 'validation_error');
}

function cleanTags(tags = []) {
  const out = [];
  for (const raw of tags) {
    const tag = String(raw).trim().toLowerCase();
    if (!TAG_RE.test(tag)) {
      throw fail('Tags may use letters, numbers, spaces, "-" and "_" (up to 32 characters).', 'validation_error');
    }
    if (!out.includes(tag)) out.push(tag);
  }
  if (out.length > MAX_TAGS) throw fail(`Use at most ${MAX_TAGS} tags.`, 'validation_error');
  return out;
}

const notFoundToNull = (e) => {
  if (e.code === 'not_found' || e.code === 'permission-denied') return null;
  throw e;
};

async function likedIds() {
  if (!auth.currentUser) return new Set();
  const snap = await getDocs(collection(db, 'users', auth.currentUser.uid, 'likes'));
  return new Set(snap.docs.map((d) => d.id));
}

/** Which of these circuits the user liked: one read per circuit shown (at most 10), not one per like ever given. */
async function likedAmong(ids) {
  if (!auth.currentUser || ids.length === 0) return new Set();
  const snap = await getDocs(
    query(collection(db, 'users', auth.currentUser.uid, 'likes'), where(documentId(), 'in', ids)),
  );
  return new Set(snap.docs.map((d) => d.id));
}

/** Whether a built-in sample passes the gallery's tag / author / Following filters. */
function matchesSample(sample, { tag, author }, followed) {
  if (author && author !== SAMPLE_AUTHOR) return false;
  if (tag === FOLLOWING_FILTER) return followed.includes(SAMPLE_AUTHOR);
  return !tag || sample.tags.includes(tag.toLowerCase());
}

function galleryItem({ approved: _a, approvedAt: _b, published: _c, folder: _d, ...p }, liked) {
  return { ...p, liked: liked.has(p.id) };
}

/** Idempotent like/unlike. The like marker and the counter change in one transaction, and the
 * rules only accept a counter change that matches a marker change, so counts cannot be forged. */
async function setLike(id, wanted) {
  if (isSampleId(id)) throw fail('Sample circuits cannot be liked.', 'validation_error');
  const projectRef = ref('projects', id);
  const likeRef = ref('users', uid(), 'likes', id);
  let owner = null;
  let title = '';
  const result = await runTransaction(db, async (tx) => {
    const [project, like] = await Promise.all([tx.get(projectRef), tx.get(likeRef)]);
    if (!project.exists() || !project.data().approved) throw fail('Circuit not found.', 'not_found');
    owner = project.data().ownerId;
    title = text(project.data().name, 140);
    const count = project.data().likeCount || 0;
    if (like.exists() === wanted) return { liked: wanted, likeCount: count };
    if (wanted) tx.set(likeRef, { createdAt: now() });
    else tx.delete(likeRef);
    tx.update(projectRef, { likeCount: increment(wanted ? 1 : -1) });
    return { liked: wanted, likeCount: count + (wanted ? 1 : -1) };
  });
  if (wanted) await notify(owner, `like_${id}_${uid()}`, { type: 'like', targetId: id, ref: '', text: title });
  return result;
}

/**
 * Tells `to` about something the signed-in user just did. Best effort: the action already happened, and a
 * notification the rules refuse (e.g. the same like again) is simply not sent. The id names the cause.
 */
async function notify(to, id, { from, ...data }) {
  if (!to || to === uid()) return;
  try {
    const handle = from ?? (await profile()).handle;
    await setDoc(ref('users', to, 'notifications', id), {
      ...data,
      text: (data.text || '').slice(0, 140),
      from: handle,
      read: false,
      createdAt: now(),
    });
  } catch {
    // not sent; nothing to undo
  }
}

/** A discussion thread or post, read defensively like projectFrom. */
const threadFrom = (d) => {
  const t = d.data();
  const likedBy = Array.isArray(t.likedBy) ? t.likedBy : [];
  return {
    id: d.id,
    userId: text(t.userId, 128),
    author: text(t.author, 64),
    title: text(t.title, 140),
    body: text(t.body, 5000),
    text: text(t.text, 2000),
    parentId: typeof t.parentId === 'string' ? t.parentId : null,
    likeCount: likedBy.length,
    liked: !!auth.currentUser && likedBy.includes(auth.currentUser.uid),
    createdAt: ms(t.createdAt),
  };
};

export const api = {
  // ---- auth ----
  me: wrap(async () => {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return null;
    // Verified on another device? Firebase only learns that on reload, and the rules read the login token.
    if (!user.emailVerified) {
      try {
        await user.reload();
        if (user.emailVerified) await user.getIdToken(true);
      } catch {
        // offline: keep what we have
      }
    }
    return loadUser(user);
  }),
  signup: wrap(async ({ name, email, password }) => {
    if (!name?.trim()) throw fail('Enter your name.', 'validation_error');
    validPassword(password);
    const { user } = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    try {
      await createProfile(user, name);
    } catch (e) {
      await deleteUser(user).catch(() => {});
      throw e;
    }
    sendEmailVerification(user).catch(() => {});
    return loadUser(user);
  }),
  login: wrap(async ({ email, password }) => {
    const { user } = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const me = await loadUser(user);
    if (!me) {
      // A Firebase account with no app profile (e.g. an admin-only account).
      await signOut(auth);
      throw fail(BAD_LOGIN, 'invalid_credentials');
    }
    return me;
  }),
  logout: wrap(() => signOut(auth)),
  updateMe: wrap(async (patch) => {
    const update = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name || name.length > 120) throw fail('Enter your name.', 'validation_error');
      update.name = name;
      update.nameLower = lowerAscii(name);
    }
    if (patch.avatar !== undefined) update.avatar = String(patch.avatar).slice(0, 32);
    await updateDoc(ref('users', uid()), update);
    return loadUser(auth.currentUser);
  }),
  changePassword: wrap(async ({ current, next }) => {
    validPassword(next);
    const user = auth.currentUser;
    if (!user) throw fail('Log in to continue.', 'not_authenticated');
    if (user.providerData.some((p) => p.providerId === 'password')) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current || ''));
      await updatePassword(user, next);
    } else {
      // OAuth-only accounts can add a password.
      await linkWithCredential(user, EmailAuthProvider.credential(user.email, next));
    }
  }),
  deleteAccount: wrap(async () => {
    const user = auth.currentUser;
    const id = uid();
    // Firebase only deletes an account after a recent sign-in; check before wiping any data.
    if (now() - Date.parse(user.metadata.lastSignInTime) > 4 * 60 * 1000) throw fail(RECENT_LOGIN, 'recent_login');
    const { handle } = await profile();
    // Unlike first: the rules only allow dropping a like together with the counter decrement.
    await Promise.allSettled([...(await likedIds())].map((projectId) => setLike(projectId, false)));
    const refsOf = async (q) => (await getDocs(q)).docs.map((d) => d.ref);
    // Notifications and threads are listed 50 at a time (the rules' limit), so delete page by page.
    const drain = async (q) => {
      for (let refs = await refsOf(q); refs.length; refs = await refsOf(q)) await deleteAll(refs);
    };
    await drain(query(collection(db, 'users', id, 'notifications'), limit(50)));
    await drain(query(collection(db, 'threads'), where('userId', '==', id), limit(50)));
    await deleteAll([
      ...(await refsOf(query(collection(db, 'projects'), where('ownerId', '==', id), limit(LIST_LIMIT)))),
      ...(await refsOf(query(collection(db, 'folders'), where('ownerId', '==', id)))),
      ...(await refsOf(query(collection(db, 'reports'), where('userId', '==', id), limit(LIST_LIMIT)))),
      ...(await refsOf(query(collectionGroup(db, 'comments'), where('userId', '==', id)))),
      ...(await refsOf(query(collectionGroup(db, 'posts'), where('userId', '==', id)))),
      ref('follows', id),
      ref('bookmarks', id),
      ref('handles', handle),
      ref('users', id),
    ]);
    await deleteUser(user);
  }),
  resendVerification: wrap(async () => {
    const user = auth.currentUser;
    if (!user) throw fail('Log in to continue.', 'not_authenticated');
    if (user.emailVerified) return { sent: false };
    await sendEmailVerification(user);
    return { sent: true };
  }),
  // `token` is the `oobCode` from the link in Firebase's verification email.
  verifyEmail: wrap(async (token) => {
    await applyActionCode(auth, token);
    if (!auth.currentUser) return { id: null, verified: true };
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true); // the rules read the verified flag from the token
    return loadUser(auth.currentUser);
  }),
  requestPasswordReset: wrap(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (e) {
      // Same answer either way so this cannot be used to probe for accounts.
      if (e.code !== 'auth/user-not-found' && e.code !== 'auth/invalid-email') throw e;
    }
    return { detail: 'If an account exists for that email, a reset link is on its way.' };
  }),
  resetPassword: wrap(async ({ token, password }) => {
    validPassword(password);
    await confirmPasswordReset(auth, token, password);
  }),

  // ---- OAuth (Firebase popup flow; enable the providers in the Firebase console) ----
  oauthProviders: async () => ({ google: true, github: true }),
  oauthLogin: wrap(async (provider) => {
    const { user } = await signInWithPopup(auth, PROVIDERS[provider]());
    let me = await loadUser(user);
    if (!me) {
      await createProfile(user, user.displayName || (user.email || '').split('@')[0]);
      me = await loadUser(user);
    }
    return me;
  }),

  // ---- admin: a normal Firebase account that also has an `admins/{uid}` document ----
  adminLogin: wrap(async ({ email, password }) => {
    const { user } = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    if (!(await getDoc(ref('admins', user.uid))).exists()) {
      await signOut(auth);
      throw fail('Invalid admin email or password.', 'invalid_credentials');
    }
    return { email: user.email };
  }),
  adminLogout: wrap(() => signOut(auth)),
  adminSession: wrap(async () => {
    await auth.authStateReady();
    const user = auth.currentUser;
    const isAdmin = !!user && (await getDoc(ref('admins', user.uid))).exists();
    return { isAdmin, email: isAdmin ? user.email : null };
  }),
  // Newest first, USERS_PAGE at a time (`after` is the previous page's `cursor`). A search matches the START of the
  // handle, email or name (Firestore has no substring search) and shows the first USERS_PAGE of each, without paging.
  adminUsers: wrap(async ({ q = '', after } = {}) => {
    const users = collection(db, 'users');
    const needle = lowerAscii(q.trim());
    let docs;
    let cursor = null;
    if (needle) {
      const byField = (f) => getDocs(query(users, orderBy(f), startAt(needle), endAt(`${needle}\uf8ff`), limit(USERS_PAGE)));
      const found = new Map();
      for (const snap of await Promise.all(['handle', 'email', 'nameLower'].map(byField))) {
        snap.docs.forEach((d) => found.set(d.id, d));
      }
      docs = [...found.values()];
    } else {
      const snap = await getDocs(
        query(users, orderBy('createdAt', 'desc'), ...(after == null ? [] : [startAfter(after)]), limit(USERS_PAGE)),
      );
      docs = snap.docs;
      cursor = snap.size === USERS_PAGE ? snap.docs.at(-1).data().createdAt : null;
    }
    const ids = docs.map((d) => d.id);
    const disabled = new Set();
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const snap = await getDocs(query(collection(db, 'disabledUsers'), where(documentId(), 'in', chunk), limit(30)));
      snap.docs.forEach((d) => disabled.add(d.id));
    }
    const count = async (...filters) =>
      (await getCountFromServer(query(collection(db, 'projects'), ...filters, limit(MAX_PROJECTS * 2)))).data().count;
    const rows = await Promise.all(
      docs.map(async (d) => {
        const data = d.data();
        const [circuits, community] = await Promise.all([
          count(where('ownerId', '==', d.id)),
          count(where('ownerId', '==', d.id), where('approved', '==', true)),
        ]);
        return {
          id: d.id,
          name: text(data.name, 120),
          handle: text(data.handle, 64),
          email: text(data.email, 200),
          createdAt: ms(data.createdAt),
          disabled: disabled.has(d.id),
          circuits,
          community,
        };
      }),
    );
    return { users: rows, cursor };
  }),
  // The circuits a user has published to Community (at most MAX_PROJECTS), for the admin panel's popup.
  adminUserCircuits: wrap(async (userId) => {
    const snap = await getDocs(
      query(collection(db, 'projects'), where('ownerId', '==', userId), where('approved', '==', true), limit(MAX_PROJECTS)),
    );
    return snap.docs
      .map(projectFrom)
      .map(({ id, name, tags, likeCount, publishedAt }) => ({ id, name, tags, likeCount, publishedAt }));
  }),
  // New users, shared circuits and discussion posts per hour (24h) or per day (7d, 30d), as count queries: about one read each.
  // shortcut: the rules cap every list at 100 (posts 50), so a busy bucket tops out there; raise it with a count-only rule.
  adminActivity: wrap(async (range) => {
    const hourly = range === '24h';
    const buckets = hourly ? 24 : range === '30d' ? 30 : 7;
    const d = new Date();
    if (hourly) {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
    } else {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
    }
    const edges = [];
    for (let i = 0; i <= buckets; i++) {
      edges.unshift(d.getTime());
      if (hourly) d.setHours(d.getHours() - 1);
      else d.setDate(d.getDate() - 1); // by calendar, so a daylight-saving day is not an hour off
    }
    const series = (col, cap, field = 'createdAt') =>
      Promise.all(
        edges.slice(0, -1).map(async (from, i) => {
          const q = query(collection(db, col), where(field, '>=', from), where(field, '<', edges[i + 1]), limit(cap));
          return (await getCountFromServer(q)).data().count;
        }),
      );
    const [users, circuits, posts] = await Promise.all([series('users', 100), series('projects', 100, 'publishedAt'), series('threads', 50)]);
    return { edges, users, circuits, posts, caps: { users: 100, circuits: 100, posts: 50 } };
  }),
  setUserDisabled: wrap(async (id, disabled) => {
    if (disabled) await setDoc(ref('disabledUsers', id), { at: now() });
    else await deleteDoc(ref('disabledUsers', id));
    return { id, disabled };
  }),
  pendingCircuits: wrap(async () => {
    const snap = await getDocs(
      query(
        collection(db, 'projects'),
        where('published', '==', true),
        where('approved', '==', false),
        limit(LIST_LIMIT),
      ),
    );
    return snap.docs.map(projectFrom).sort((a, b) => b.publishedAt - a.publishedAt);
  }),
  // `seen` is the updatedAt the admin was shown. Every owner edit stamps a new server time (see the rules),
  // so a different value means the circuit changed after review and must be looked at again.
  approveCircuit: wrap(async (id, seen) => {
    const projectRef = ref('projects', id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(projectRef);
      if (!snap.exists() || ms(snap.data().updatedAt) !== seen) {
        throw fail('This circuit changed since you opened it. Review it again before approving.', 'conflict');
      }
      tx.update(projectRef, { approved: true, approvedAt: now() });
    });
  }),
  // Newest reports first; each names the circuit, so the panel can link to it.
  adminReports: wrap(async () => {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(REPORTS_SHOWN)));
    return snap.docs.map((d) => ({
      id: d.id,
      projectId: text(d.data().projectId, 64),
      reason: text(d.data().reason, 500),
      createdAt: ms(d.data().createdAt),
    }));
  }),
  dismissReport: wrap(async (id) => {
    await deleteDoc(ref('reports', id));
    return id;
  }),
  rejectCircuit: wrap(async (id) => {
    await updateDoc(ref('projects', id), { published: false, approved: false, approvedAt: null });
  }),

  // ---- projects ----
  projects: wrap(async () => {
    const snap = await getDocs(query(collection(db, 'projects'), where('ownerId', '==', uid()), limit(LIST_LIMIT)));
    return snap.docs.map(projectFrom).sort((a, b) => b.updatedAt - a.updatedAt);
  }),
  project: wrap(async (id) => {
    try {
      return projectFrom(await ownProject(id));
    } catch (e) {
      return notFoundToNull(e);
    }
  }),
  create: wrap(async (templateKey, name) =>
    addProject({ ...buildTemplate(templateKey || DEFAULT_TEMPLATE), name }),
  ),
  save: wrap(async (id, patch) => {
    // Editing a live circuit sends it back to review (the rules require it).
    const update = { updatedAt: serverTimestamp(), approved: false, approvedAt: null };
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw fail('Name cannot be blank.', 'validation_error');
      update.name = patch.name.trim().slice(0, 120);
      update.nameLower = lowerAscii(update.name);
    }
    if (patch.parts) update.parts = JSON.stringify(cleanParts(patch.parts));
    if (patch.wires) update.wires = JSON.stringify(patch.wires);
    if (patch.code !== undefined) update.code = patch.code;
    if (patch.tags) update.tags = cleanTags(patch.tags);
    await updateDoc(ref('projects', id), update);
    return projectFrom(await getDoc(ref('projects', id)));
  }),
  remove: wrap(async (id) => {
    const batch = writeBatch(db);
    batch.delete(ref('projects', id));
    batch.set(ref('limits', uid()), { removedId: id, projectCount: increment(-1) }, { merge: true });
    await batch.commit();
  }),
  duplicate: wrap(async (id) => {
    const source = projectFrom(await ownProject(id));
    return addProject({ ...source, name: `Copy of ${source.name}` });
  }),
  publish: wrap(async (id, { description, tags } = {}) => {
    await requireVerified();
    const t = now();
    await updateDoc(ref('projects', id), {
      description: (description ?? '').slice(0, 2000),
      tags: cleanTags(tags),
      published: true,
      approved: false,
      approvedAt: null,
      publishedAt: t,
      updatedAt: serverTimestamp(),
    });
    return projectFrom(await getDoc(ref('projects', id)));
  }),
  unpublish: wrap(async (id) => {
    await updateDoc(ref('projects', id), {
      published: false,
      approved: false,
      approvedAt: null,
      updatedAt: serverTimestamp(),
    });
    return projectFrom(await getDoc(ref('projects', id)));
  }),
  exportProject: wrap(async (id) => {
    const { name, parts, wires, code } = projectFrom(await ownProject(id));
    return { name, parts, wires, code };
  }),
  importProject: wrap(async (data) => {
    if (!Array.isArray(data?.parts) || !Array.isArray(data?.wires)) {
      throw fail('That file is not a Techomato circuit.', 'validation_error');
    }
    return addProject({ ...data, name: data.name?.trim() || 'Imported circuit' });
  }),

  // ---- folders ----
  folders: wrap(async () => {
    const snap = await getDocs(query(collection(db, 'folders'), where('ownerId', '==', uid())));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => a.createdAt - b.createdAt);
  }),
  // A user's folders live at the fixed ids `<uid>_1..3` (the rules allow no others), which is what caps them.
  createFolder: wrap(async (name) => {
    const taken = new Set((await api.folders()).map((f) => f.id));
    const id = Array.from({ length: MAX_FOLDERS }, (_, i) => `${uid()}_${i + 1}`).find((slot) => !taken.has(slot));
    if (!id) throw fail(`You can have up to ${MAX_FOLDERS} folders. Delete one to make room.`, 'limit_reached');
    const data = { ownerId: uid(), name: (name || '').trim().slice(0, 80) || 'New folder', createdAt: now() };
    await setDoc(ref('folders', id), data);
    return { ...data, id };
  }),
  renameFolder: wrap(async (id, name) => {
    const clean = (name || '').trim().slice(0, 80);
    if (!clean) throw fail('Name cannot be blank.', 'validation_error');
    await updateDoc(ref('folders', id), { name: clean });
    return { id, name: clean };
  }),
  deleteFolder: wrap(async (id) => {
    const inside = await getDocs(
      query(collection(db, 'projects'), where('ownerId', '==', uid()), where('folder', '==', id), limit(LIST_LIMIT)),
    );
    const batch = writeBatch(db);
    inside.docs.forEach((d) => batch.update(d.ref, { folder: null, updatedAt: serverTimestamp() }));
    batch.delete(ref('folders', id));
    await batch.commit();
  }),
  moveToFolder: wrap(async (projectId, folderId) => {
    await updateDoc(ref('projects', projectId), { folder: folderId || null, updatedAt: serverTimestamp() });
    return projectFrom(await getDoc(ref('projects', projectId)));
  }),

  // ---- community / gallery ----
  // Pages of GALLERY_PAGE, newest first; `after` is the previous page's `cursor`. Tag and author filter
  // in the query. shortcut: the page's search, "Following" and "Most liked" only see the pages loaded so
  // far, move them into queries (more indexes) or a search service once that is not enough.
  gallery: wrap(async ({ tag = '', author = '', after } = {}) => {
    const filters = [where('approved', '==', true)];
    if (author) filters.push(where('author', '==', author));
    if (tag && tag !== FOLLOWING_FILTER) filters.push(where('tags', 'array-contains', tag.toLowerCase()));
    const [snap, handles] = await Promise.all([
      getDocs(
        query(
          collection(db, 'projects'),
          ...filters,
          orderBy('publishedAt', 'desc'),
          ...(after == null ? [] : [startAfter(after)]),
          limit(GALLERY_PAGE),
        ),
      ),
      tag === FOLLOWING_FILTER ? api.following() : [],
    ]);
    const liked = await likedAmong(snap.docs.map((d) => d.id));
    const items = snap.docs
      .map((d) => galleryItem(projectFrom(d), liked))
      .filter((p) => tag !== FOLLOWING_FILTER || handles.includes(p.author));
    // A full page means there may be more; the cursor is the last raw doc, not the last filtered one.
    const cursor = snap.size === GALLERY_PAGE ? snap.docs.at(-1).data().publishedAt : null;
    // The built-in samples close the list, so they show on the last page only.
    if (cursor === null) items.push(...getSamples().filter((s) => matchesSample(s, { tag, author }, handles)));
    return { items, cursor };
  }),
  item: wrap(async (id) => {
    if (isSampleId(id)) return getSample(id) ?? null;
    try {
      const snap = await getDoc(ref('projects', id));
      if (!snap.exists() || !snap.data().approved) return null;
      return galleryItem(projectFrom(snap), await likedAmong([id]));
    } catch (e) {
      return notFoundToNull(e);
    }
  }),
  like: wrap((id) => setLike(id, true)),
  unlike: wrap((id) => setLike(id, false)),
  remix: wrap(async (id) => {
    if (isSampleId(id)) return addProject({ ...getSample(id), name: `${getSample(id).name} (remix)` });
    const snap = await getDoc(ref('projects', id));
    if (!snap.exists() || !snap.data().approved) throw fail('Circuit not found.', 'not_found');
    const source = projectFrom(snap);
    return addProject({ ...source, name: `${source.name} (remix)` });
  }),
  comments: wrap(async (itemId) => {
    if (isSampleId(itemId)) return [];
    // shortcut: only the newest COMMENTS_SHOWN show (and cost reads); add "Load more" if a thread needs more.
    const snap = await getDocs(
      query(collection(db, 'projects', itemId, 'comments'), orderBy('createdAt', 'desc'), limit(COMMENTS_SHOWN)),
    );
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id, createdAt: ms(d.data().createdAt) }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }),
  addComment: wrap(async (itemId, text) => {
    const clean = (text || '').trim();
    if (!clean) throw fail('Write something first.', 'validation_error');
    if (clean.length > 2000) throw fail('Comments can be up to 2000 characters.', 'validation_error');
    if (isSampleId(itemId)) throw fail('Comments are closed on sample circuits.', 'validation_error');
    await requireVerified();
    const { name, handle } = await profile();
    const data = { userId: uid(), name, text: clean, createdAt: now() };
    const commentRef = doc(collection(db, 'projects', itemId, 'comments'));
    const batch = writeBatch(db);
    batch.set(commentRef, data);
    batch.set(ref('limits', uid()), { comment: serverTimestamp(), commentId: commentRef.id }, { merge: true });
    await batch.commit().catch((e) => {
      throw slowDown(e);
    });
    const owner = (await getDoc(ref('projects', itemId)).catch(() => null))?.data()?.ownerId;
    await notify(owner, `comment_${commentRef.id}`, { type: 'comment', targetId: itemId, ref: commentRef.id, text: '', from: handle });
    return { ...data, id: commentRef.id };
  }),
  deleteComment: wrap(async (itemId, commentId) => {
    await deleteDoc(ref('projects', itemId, 'comments', commentId));
  }),

  // ---- discussions ----
  threads: wrap(async ({ after } = {}) => {
    const snap = await getDocs(
      query(
        collection(db, 'threads'),
        orderBy('createdAt', 'desc'),
        ...(after == null ? [] : [startAfter(after)]),
        limit(THREADS_PAGE),
      ),
    );
    // No reply counts here: one count query per thread would double the cost of every list view.
    const items = snap.docs.map(threadFrom);
    return { items, cursor: snap.size === THREADS_PAGE ? ms(snap.docs.at(-1).data().createdAt) : null };
  }),
  // shortcut: shows the first POSTS_SHOWN comments and replies only; add paging when a thread needs more.
  thread: wrap(async (id) => {
    const snap = await getDoc(ref('threads', id));
    if (!snap.exists()) return null;
    const posts = await getDocs(query(collection(db, 'threads', id, 'posts'), orderBy('createdAt'), limit(POSTS_SHOWN)));
    return { ...threadFrom(snap), posts: posts.docs.map(threadFrom) };
  }),
  createThread: wrap(async ({ title, body }) => {
    const cleanTitle = (title || '').trim();
    const cleanBody = (body || '').trim();
    if (cleanTitle.length < 3) throw fail('Give your post a title of at least 3 characters.', 'validation_error');
    if (cleanTitle.length > 140) throw fail('Titles can be up to 140 characters.', 'validation_error');
    if (!cleanBody) throw fail('Write something first.', 'validation_error');
    if (cleanBody.length > 5000) throw fail('Posts can be up to 5000 characters.', 'validation_error');
    await requireVerified();
    const { handle } = await profile();
    const threadRef = doc(collection(db, 'threads'));
    const data = { userId: uid(), author: handle, title: cleanTitle, body: cleanBody, likedBy: [], createdAt: now() };
    const batch = writeBatch(db);
    batch.set(threadRef, data);
    batch.set(ref('limits', uid()), { thread: serverTimestamp(), threadId: threadRef.id }, { merge: true });
    await batch.commit().catch((e) => {
      if (e.code === 'permission-denied') throw fail('You can start one discussion a minute. Try again soon.', 'throttled');
      throw e;
    });
    return { ...threadFrom({ id: threadRef.id, data: () => data }), posts: [] };
  }),
  // A comment on a thread (parentId null) or a reply to one of its comments.
  addPost: wrap(async (threadId, body, parentId = null) => {
    const clean = (body || '').trim();
    if (!clean) throw fail('Write something first.', 'validation_error');
    if (clean.length > 2000) throw fail('Comments can be up to 2000 characters.', 'validation_error');
    await requireVerified();
    const { handle } = await profile();
    const postRef = doc(collection(db, 'threads', threadId, 'posts'));
    const data = { userId: uid(), author: handle, text: clean, parentId, likedBy: [], createdAt: now() };
    const batch = writeBatch(db);
    batch.set(postRef, data);
    batch.set(ref('limits', uid()), { comment: serverTimestamp(), commentId: postRef.id }, { merge: true });
    await batch.commit().catch((e) => {
      throw slowDown(e);
    });
    const parent = parentId ? ref('threads', threadId, 'posts', parentId) : ref('threads', threadId);
    const to = (await getDoc(parent).catch(() => null))?.data()?.userId;
    await notify(to, `reply_${postRef.id}`, { type: 'reply', targetId: threadId, ref: postRef.id, text: '', from: handle });
    return threadFrom({ id: postRef.id, data: () => data });
  }),
  // `postId` null likes the thread itself.
  setDiscussionLike: wrap(async (threadId, postId, on) => {
    const target = postId ? ref('threads', threadId, 'posts', postId) : ref('threads', threadId);
    await updateDoc(target, { likedBy: on ? arrayUnion(uid()) : arrayRemove(uid()) });
    return { threadId, postId, liked: on };
  }),
  deleteThread: wrap(async (id) => {
    await deleteDoc(ref('threads', id));
  }),
  deletePost: wrap(async (threadId, postId) => {
    await deleteDoc(ref('threads', threadId, 'posts', postId));
  }),

  // ---- notifications ----
  notifications: wrap(async (count = NOTIFICATIONS_SHOWN) => {
    if (!auth.currentUser) return [];
    const snap = await getDocs(
      query(collection(db, 'users', uid(), 'notifications'), orderBy('createdAt', 'desc'), limit(count)),
    );
    return snap.docs.map((d) => ({
      id: d.id,
      type: text(d.data().type, 16),
      from: text(d.data().from, 64),
      targetId: text(d.data().targetId, 128),
      text: text(d.data().text, 140),
      read: d.data().read === true,
      createdAt: ms(d.data().createdAt),
    }));
  }),
  markNotificationsRead: wrap(async (ids) => {
    const batch = writeBatch(db);
    ids.forEach((id) => batch.update(ref('users', uid(), 'notifications', id), { read: true }));
    await batch.commit();
    return ids;
  }),

  // ---- search / bookmarks / reports ----
  // Matches the START of circuit names (Firestore has no substring search), across every shared circuit.
  searchGallery: wrap(async (q) => {
    const needle = lowerAscii((q || '').trim());
    if (!needle) return [];
    const snap = await getDocs(
      query(
        collection(db, 'projects'),
        where('approved', '==', true),
        orderBy('nameLower'),
        startAt(needle),
        endAt(`${needle}\uf8ff`),
        limit(SEARCH_SHOWN),
      ),
    );
    const liked = await likedAmong(snap.docs.map((d) => d.id));
    const samples = getSamples().filter((s) => lowerAscii(s.name).startsWith(needle));
    return [...snap.docs.map((d) => galleryItem(projectFrom(d), liked)), ...samples];
  }),
  bookmarks: wrap(async () => {
    if (!auth.currentUser) return [];
    const ids = (await getDoc(ref('bookmarks', uid()))).data()?.ids;
    return Array.isArray(ids) ? ids.filter((i) => typeof i === 'string') : [];
  }),
  setBookmark: wrap(async (id, on) => {
    if (on && (await api.bookmarks()).length >= MAX_BOOKMARKS) {
      throw fail(`You can save up to ${MAX_BOOKMARKS} circuits.`, 'limit_reached');
    }
    await setDoc(ref('bookmarks', uid()), { ids: on ? arrayUnion(id) : arrayRemove(id) }, { merge: true });
    return { id, saved: on };
  }),
  // The saved circuits that are still shared, newest save first, plus the ids that are not (deleted, or back in
  // review after an edit: the two look the same from here, so they are only removed when the user asks).
  savedItems: wrap(async () => {
    const ids = (await api.bookmarks()).reverse();
    const real = ids.filter((id) => !isSampleId(id));
    const found = new Map();
    for (let i = 0; i < real.length; i += 30) {
      const chunk = real.slice(i, i + 30);
      const snap = await getDocs(
        query(collection(db, 'projects'), where(documentId(), 'in', chunk), where('approved', '==', true), limit(30)),
      );
      const liked = await likedAmong(snap.docs.map((d) => d.id));
      snap.docs.forEach((d) => found.set(d.id, galleryItem(projectFrom(d), liked)));
    }
    const items = ids.map((id) => (isSampleId(id) ? getSample(id) : found.get(id)));
    return { items: items.filter(Boolean), missing: ids.filter((_, i) => !items[i]) };
  }),
  forgetBookmarks: wrap(async (ids) => {
    await setDoc(ref('bookmarks', uid()), { ids: arrayRemove(...ids) }, { merge: true });
  }),
  // One report per user per circuit: the id is `<circuit>_<user>` and the rules refuse to overwrite it.
  reportCircuit: wrap(async (projectId, reason) => {
    const clean = (reason || '').trim();
    if (!clean) throw fail('Say what is wrong with this circuit.', 'validation_error');
    if (clean.length > 500) throw fail('Keep the report under 500 characters.', 'validation_error');
    if (isSampleId(projectId)) throw fail('Sample circuits cannot be reported.', 'validation_error');
    await requireVerified();
    const reportId = `${projectId}_${uid()}`;
    const reportRef = ref('reports', reportId);
    if ((await getDoc(reportRef)).exists()) throw fail('You already reported this circuit.', 'conflict');
    const batch = writeBatch(db);
    batch.set(reportRef, { projectId, userId: uid(), reason: clean, createdAt: now() });
    batch.set(ref('limits', uid()), { comment: serverTimestamp(), commentId: reportId }, { merge: true });
    await batch.commit().catch((e) => {
      throw slowDown(e);
    });
    return { projectId };
  }),

  // ---- follows ----
  following: wrap(async () => {
    if (!auth.currentUser) return [];
    const handles = (await getDoc(ref('follows', uid()))).data()?.handles;
    return Array.isArray(handles) ? handles.filter((h) => typeof h === 'string') : [];
  }),
  follow: wrap(async (handle) => {
    if (!HANDLE_RE.test(handle)) throw fail('Invalid author handle.', 'validation_error');
    if (handle === (await profile()).handle) throw fail('You cannot follow yourself.', 'validation_error');
    const current = await api.following();
    if (!current.includes(handle) && current.length >= MAX_FOLLOWS) {
      throw fail(`You can follow up to ${MAX_FOLLOWS} authors.`, 'limit_reached');
    }
    await setDoc(ref('follows', uid()), { handles: arrayUnion(handle) }, { merge: true });
    return { handle, following: true };
  }),
  unfollow: wrap(async (handle) => {
    await setDoc(ref('follows', uid()), { handles: arrayRemove(handle) }, { merge: true });
    return { handle, following: false };
  }),
};
