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
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { buildTemplate } from '@/lib/templates';

const MAX_TAGS = 10;
const TAG_RE = /^[a-z0-9][a-z0-9 _-]{0,31}$/;
const HANDLE_RE = /^[A-Za-z0-9_]{1,64}$/;
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
  return {
    ownerId,
    author,
    name: (name || '').trim().slice(0, 120) || 'Untitled circuit',
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

function projectFrom(snap) {
  const d = snap.data();
  return { ...d, id: snap.id, parts: JSON.parse(d.parts || '[]'), wires: JSON.parse(d.wires || '[]') };
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
    batch.set(ref('users', fbUser.uid), { name: cleanName, handle, avatar: '', createdAt: t });
    batch.set(doc(collection(db, 'projects')), newProjectDoc(fbUser.uid, handle, starter, t));
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

async function addProject(source) {
  const { handle } = await profile();
  const created = await addDoc(collection(db, 'projects'), newProjectDoc(uid(), handle, source));
  return projectFrom(await getDoc(created));
}

async function deleteAll(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
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

function galleryItem({ approved: _a, approvedAt: _b, published: _c, folder: _d, ...p }, liked) {
  return { ...p, liked: liked.has(p.id) };
}

/** Idempotent like/unlike. The like marker and the counter change in one transaction, and the
 * rules only accept a counter change that matches a marker change, so counts cannot be forged. */
async function setLike(id, wanted) {
  const projectRef = ref('projects', id);
  const likeRef = ref('users', uid(), 'likes', id);
  return runTransaction(db, async (tx) => {
    const [project, like] = await Promise.all([tx.get(projectRef), tx.get(likeRef)]);
    if (!project.exists() || !project.data().approved) throw fail('Circuit not found.', 'not_found');
    const count = project.data().likeCount || 0;
    if (like.exists() === wanted) return { liked: wanted, likeCount: count };
    if (wanted) tx.set(likeRef, { createdAt: now() });
    else tx.delete(likeRef);
    tx.update(projectRef, { likeCount: increment(wanted ? 1 : -1) });
    return { liked: wanted, likeCount: count + (wanted ? 1 : -1) };
  });
}

export const api = {
  // ---- auth ----
  me: wrap(async () => {
    await auth.authStateReady();
    return auth.currentUser ? loadUser(auth.currentUser) : null;
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
    const refsOf = async (q) => (await getDocs(q)).docs.map((d) => d.ref);
    await deleteAll([
      ...(await refsOf(query(collection(db, 'projects'), where('ownerId', '==', id)))),
      ...(await refsOf(query(collection(db, 'folders'), where('ownerId', '==', id)))),
      ...(await refsOf(query(collectionGroup(db, 'comments'), where('userId', '==', id)))),
      ...(await refsOf(collection(db, 'users', id, 'following'))),
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
  pendingCircuits: wrap(async () => {
    const snap = await getDocs(
      query(collection(db, 'projects'), where('published', '==', true), where('approved', '==', false)),
    );
    return snap.docs.map(projectFrom).sort((a, b) => b.publishedAt - a.publishedAt);
  }),
  approveCircuit: wrap(async (id) => {
    const t = now();
    await updateDoc(ref('projects', id), { approved: true, approvedAt: t, updatedAt: t });
  }),
  rejectCircuit: wrap(async (id) => {
    await updateDoc(ref('projects', id), { published: false, approved: false, approvedAt: null, updatedAt: now() });
  }),

  // ---- projects ----
  projects: wrap(async () => {
    const snap = await getDocs(query(collection(db, 'projects'), where('ownerId', '==', uid())));
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
    const update = { updatedAt: now() };
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw fail('Name cannot be blank.', 'validation_error');
      update.name = patch.name.trim().slice(0, 120);
    }
    if (patch.parts) update.parts = JSON.stringify(cleanParts(patch.parts));
    if (patch.wires) update.wires = JSON.stringify(patch.wires);
    if (patch.code !== undefined) update.code = patch.code;
    await updateDoc(ref('projects', id), update);
    return projectFrom(await getDoc(ref('projects', id)));
  }),
  remove: wrap(async (id) => {
    await deleteDoc(ref('projects', id));
  }),
  duplicate: wrap(async (id) => {
    const source = projectFrom(await ownProject(id));
    return addProject({ ...source, name: `Copy of ${source.name}` });
  }),
  publish: wrap(async (id, { description, tags } = {}) => {
    const t = now();
    await updateDoc(ref('projects', id), {
      description: (description ?? '').slice(0, 2000),
      tags: cleanTags(tags),
      published: true,
      approved: false,
      approvedAt: null,
      publishedAt: t,
      updatedAt: t,
    });
    return projectFrom(await getDoc(ref('projects', id)));
  }),
  unpublish: wrap(async (id) => {
    await updateDoc(ref('projects', id), { published: false, approved: false, approvedAt: null, updatedAt: now() });
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
  createFolder: wrap(async (name) => {
    const data = { ownerId: uid(), name: (name || '').trim().slice(0, 80) || 'New folder', createdAt: now() };
    const created = await addDoc(collection(db, 'folders'), data);
    return { ...data, id: created.id };
  }),
  renameFolder: wrap(async (id, name) => {
    const clean = (name || '').trim().slice(0, 80);
    if (!clean) throw fail('Name cannot be blank.', 'validation_error');
    await updateDoc(ref('folders', id), { name: clean });
    return { id, name: clean };
  }),
  deleteFolder: wrap(async (id) => {
    const inside = await getDocs(
      query(collection(db, 'projects'), where('ownerId', '==', uid()), where('folder', '==', id)),
    );
    const batch = writeBatch(db);
    inside.docs.forEach((d) => batch.update(d.ref, { folder: null }));
    batch.delete(ref('folders', id));
    await batch.commit();
  }),
  moveToFolder: wrap(async (projectId, folderId) => {
    await updateDoc(ref('projects', projectId), { folder: folderId || null });
    return projectFrom(await getDoc(ref('projects', projectId)));
  }),

  // ---- community / gallery ----
  // shortcut: loads every approved circuit and filters/sorts in the browser; switch to paged
  // queries (or a search service) once the gallery outgrows a few hundred circuits.
  gallery: wrap(async ({ q = '', tag = '', author = '', sort = 'popular' } = {}) => {
    const [snap, liked, handles] = await Promise.all([
      getDocs(query(collection(db, 'projects'), where('approved', '==', true))),
      likedIds(),
      tag === FOLLOWING_FILTER ? api.following() : [],
    ]);
    const needle = q.trim().toLowerCase();
    return snap.docs
      .map((d) => galleryItem(projectFrom(d), liked))
      .filter((p) => {
        if (needle && !`${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
        if (tag === FOLLOWING_FILTER && !handles.includes(p.author)) return false;
        if (tag && tag !== FOLLOWING_FILTER && !p.tags.includes(tag.toLowerCase())) return false;
        return !author || p.author === author;
      })
      .sort((a, b) => (sort === 'new' ? 0 : b.likeCount - a.likeCount) || b.publishedAt - a.publishedAt);
  }),
  item: wrap(async (id) => {
    try {
      const snap = await getDoc(ref('projects', id));
      if (!snap.exists() || !snap.data().approved) return null;
      return galleryItem(projectFrom(snap), await likedIds());
    } catch (e) {
      return notFoundToNull(e);
    }
  }),
  like: wrap((id) => setLike(id, true)),
  unlike: wrap((id) => setLike(id, false)),
  remix: wrap(async (id) => {
    const snap = await getDoc(ref('projects', id));
    if (!snap.exists() || !snap.data().approved) throw fail('Circuit not found.', 'not_found');
    const source = projectFrom(snap);
    return addProject({ ...source, name: `${source.name} (remix)` });
  }),
  comments: wrap(async (itemId) => {
    const snap = await getDocs(collection(db, 'projects', itemId, 'comments'));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => a.createdAt - b.createdAt);
  }),
  addComment: wrap(async (itemId, text) => {
    const clean = (text || '').trim();
    if (!clean) throw fail('Write something first.', 'validation_error');
    if (clean.length > 2000) throw fail('Comments can be up to 2000 characters.', 'validation_error');
    const { name } = await profile();
    const data = { userId: uid(), name, text: clean, createdAt: now() };
    const created = await addDoc(collection(db, 'projects', itemId, 'comments'), data);
    return { ...data, id: created.id };
  }),
  deleteComment: wrap(async (itemId, commentId) => {
    await deleteDoc(ref('projects', itemId, 'comments', commentId));
  }),

  // ---- follows ----
  following: wrap(async () => {
    if (!auth.currentUser) return [];
    const snap = await getDocs(collection(db, 'users', uid(), 'following'));
    return snap.docs.map((d) => d.id);
  }),
  follow: wrap(async (handle) => {
    if (!HANDLE_RE.test(handle)) throw fail('Invalid author handle.', 'validation_error');
    if (handle === (await profile()).handle) throw fail('You cannot follow yourself.', 'validation_error');
    await setDoc(ref('users', uid(), 'following', handle), { createdAt: now() });
    return { handle, following: true };
  }),
  unfollow: wrap(async (handle) => {
    await deleteDoc(ref('users', uid(), 'following', handle));
    return { handle, following: false };
  }),
};
