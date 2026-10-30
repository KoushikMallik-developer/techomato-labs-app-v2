import { describe, it, expect, vi, beforeEach } from 'vitest';

const fb = vi.hoisted(() => ({
  auth: { currentUser: null, authStateReady: () => Promise.resolve() },
  signIn: vi.fn(),
  create: vi.fn(),
  signOut: vi.fn(),
  runTx: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ auth: fb.auth, db: {} }));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: fb.signIn,
  createUserWithEmailAndPassword: fb.create,
  signOut: fb.signOut,
  EmailAuthProvider: {},
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path) => path.join('/')),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: fb.runTx,
  setDoc: fb.setDoc,
  updateDoc: fb.updateDoc,
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIME'),
  getDoc: fb.getDoc,
  arrayUnion: vi.fn((h) => ['union', h]),
  arrayRemove: vi.fn((h) => ['remove', h]),
  orderBy: vi.fn((...a) => ['orderBy', ...a]),
  startAt: vi.fn((v) => ['startAt', v]),
  endAt: vi.fn((v) => ['endAt', v]),
  startAfter: vi.fn((v) => ['startAfter', v]),
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 2 }) })),
  documentId: vi.fn(() => 'docId'),
  limit: vi.fn((n) => ['limit', n]),
}));

import { api, projectFrom } from './api';

beforeEach(() => {
  vi.clearAllMocks();
  fb.auth.currentUser = null;
});

describe('api (Firebase)', () => {
  it('me() is null when nobody is signed in', async () => {
    expect(await api.me()).toBeNull();
  });

  it('rejects short passwords before touching Firebase', async () => {
    await expect(api.signup({ name: 'Ada', email: 'a@b.com', password: 'short' })).rejects.toThrow(
      'Password must be at least 8 characters.',
    );
    expect(fb.create).not.toHaveBeenCalled();
  });

  it('turns Firebase credential errors into a friendly message and code', async () => {
    fb.signIn.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    await expect(api.login({ email: 'a@b.com', password: 'whatever1' })).rejects.toMatchObject({
      message: 'Email or password is incorrect.',
      code: 'invalid_credentials',
    });
  });

  it('says the service is busy when the free quota is used up', async () => {
    fb.signIn.mockRejectedValue(Object.assign(new Error('Quota exceeded.'), { code: 'resource-exhausted' }));
    await expect(api.login({ email: 'a@b.com', password: 'whatever1' })).rejects.toMatchObject({
      message: 'The service is busy right now. Please try again in a little while.',
      code: 'busy',
    });
  });

  it('hides raw Firebase errors from users but logs them', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = Object.assign(new Error('The query requires an index. https://console.firebase.google.com/x'), {
      name: 'FirebaseError',
      code: 'failed-precondition',
    });
    fb.signIn.mockRejectedValue(raw);
    await expect(api.login({ email: 'a@b.com', password: 'whatever1' })).rejects.toMatchObject({
      message: 'Something went wrong. Please try again.',
    });
    expect(spy).toHaveBeenCalledWith(raw);
    spy.mockRestore();
  });

  it('requires sign-in for per-user data', async () => {
    await expect(api.projects()).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});

describe('comments (a thread must not cost unbounded reads)', () => {
  it('asks Firestore for at most the newest 50 and returns them oldest first', async () => {
    const { limit } = await import('firebase/firestore');
    const { getDocs } = await import('firebase/firestore');
    const doc = (id, createdAt) => ({ id, data: () => ({ text: id, createdAt }) });
    getDocs.mockResolvedValue({ docs: [doc('b', 2), doc('a', 1)] });
    const list = await api.comments('p1');
    expect(limit).toHaveBeenCalledWith(50);
    expect(list.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('me() after verifying on another device', () => {
  it('re-checks an unverified user with Firebase and refreshes the token', async () => {
    const user = {
      uid: 'u1', email: 'a@b.com', emailVerified: false, providerData: [],
      reload: vi.fn(async () => {
        user.emailVerified = true;
      }),
      getIdToken: vi.fn(),
    };
    fb.auth.currentUser = user;
    fb.getDoc.mockImplementation(async (path) => ({
      exists: () => path !== 'disabledUsers/u1',
      data: () => ({ name: 'Ada', handle: 'ada_1' }),
    }));
    const me = await api.me();
    expect(me.verified).toBe(true);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
});

describe('save', () => {
  beforeEach(() => {
    fb.auth.currentUser = { uid: 'u1' };
    fb.getDoc.mockResolvedValue({ id: 'p1', exists: () => true, data: () => ({}) });
  });

  it('stores cleaned tags (the Edit tags box relies on it)', async () => {
    await api.save('p1', { tags: ['Beginner', 'beginner', ' Sensors '] });
    expect(fb.updateDoc).toHaveBeenCalledWith('projects/p1', expect.objectContaining({ tags: ['beginner', 'sensors'] }));
  });

  it('refuses a bad tag instead of saving it', async () => {
    await expect(api.save('p1', { tags: ['no way!'] })).rejects.toMatchObject({ code: 'validation_error' });
    expect(fb.updateDoc).not.toHaveBeenCalled();
  });
});

describe('adminUsers', () => {
  const userDoc = (id, data) => ({ id, data: () => data });

  it('returns one page with counts, flags and the cursor for the next page', async () => {
    const { getDocs } = await import('firebase/firestore');
    const page = Array.from({ length: 20 }, (_, i) => userDoc(`u${i}`, { name: `N${i}`, handle: `h${i}`, email: `e${i}@x.com`, createdAt: 1000 - i }));
    getDocs.mockResolvedValueOnce({ docs: page, size: 20 }); // the users
    getDocs.mockResolvedValue({ docs: [{ id: 'u3' }] }); // u3 is disabled
    const { users, cursor } = await api.adminUsers({});
    expect(users).toHaveLength(20);
    expect(users[0]).toMatchObject({ id: 'u0', email: 'e0@x.com', circuits: 2, community: 2, disabled: false });
    expect(users.find((u) => u.id === 'u3').disabled).toBe(true);
    expect(cursor).toBe(1000 - 19); // createdAt of the last user on the page
  });

  it('searches the start of handle, email and name, and has no next page', async () => {
    const { getDocs } = await import('firebase/firestore');
    const { startAt } = await import('firebase/firestore');
    getDocs.mockResolvedValueOnce({ docs: [userDoc('u1', { name: 'Ada', handle: 'ada' })] });
    getDocs.mockResolvedValueOnce({ docs: [userDoc('u1', { name: 'Ada', handle: 'ada' })] }); // same user via email
    getDocs.mockResolvedValueOnce({ docs: [] });
    getDocs.mockResolvedValue({ docs: [] });
    const { users, cursor } = await api.adminUsers({ q: '  AD ' });
    expect(startAt).toHaveBeenCalledWith('ad');
    expect(users.map((u) => u.id)).toEqual(['u1']); // found twice, listed once
    expect(cursor).toBeNull();
  });
});

describe('disabled accounts', () => {
  const asUser = (uid) => ({ uid, email: 'a@b.com', emailVerified: true, providerData: [] });

  it('cannot sign in, and is signed straight back out', async () => {
    fb.signIn.mockResolvedValue({ user: asUser('u1') });
    fb.getDoc.mockImplementation(async (path) => ({ exists: () => path === 'disabledUsers/u1', data: () => ({}) }));
    await expect(api.login({ email: 'a@b.com', password: 'whatever1' })).rejects.toMatchObject({
      message: 'This account has been disabled.',
      code: 'account_disabled',
    });
    expect(fb.signOut).toHaveBeenCalled();
  });

  it('an admin can disable (write the flag) and enable (delete it) an account', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await api.setUserDisabled('u9', true);
    expect(fb.setDoc).toHaveBeenCalledWith('disabledUsers/u9', { at: expect.any(Number) });
    await api.setUserDisabled('u9', false);
    expect(deleteDoc).toHaveBeenCalledWith('disabledUsers/u9');
  });
});

describe('unverified email', () => {
  it('cannot comment or share, and nothing is written', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    fb.auth.currentUser = { uid: 'u1', emailVerified: false, reload, getIdToken: vi.fn() };
    await expect(api.addComment('p1', 'hello')).rejects.toMatchObject({ code: 'unverified' });
    await expect(api.publish('p1', { description: '', tags: [] })).rejects.toMatchObject({ code: 'unverified' });
    expect(reload).toHaveBeenCalled(); // it re-checks with Firebase before refusing
    expect(fb.setDoc).not.toHaveBeenCalled();
  });
});

describe('folders (three fixed slots per user)', () => {
  const owned = (...ids) => ({ docs: ids.map((id, i) => ({ id, data: () => ({ createdAt: i }) })) });

  it('uses the first free slot', async () => {
    const { getDocs } = await import('firebase/firestore');
    fb.auth.currentUser = { uid: 'u1' };
    getDocs.mockResolvedValue(owned('u1_1', 'u1_3'));
    const folder = await api.createFolder('Sensors');
    expect(folder.id).toBe('u1_2');
    expect(fb.setDoc).toHaveBeenCalledWith('folders/u1_2', expect.objectContaining({ ownerId: 'u1', name: 'Sensors' }));
  });

  it('refuses a fourth folder without writing anything', async () => {
    const { getDocs } = await import('firebase/firestore');
    fb.auth.currentUser = { uid: 'u1' };
    getDocs.mockResolvedValue(owned('u1_1', 'u1_2', 'u1_3'));
    await expect(api.createFolder('One too many')).rejects.toMatchObject({ code: 'limit_reached' });
    expect(fb.setDoc).not.toHaveBeenCalled();
  });
});

describe('follow (at most 500 authors)', () => {
  const handles = Array.from({ length: 500 }, (_, i) => `a_${i}`);
  beforeEach(() => {
    fb.auth.currentUser = { uid: 'u1' };
    fb.getDoc.mockImplementation(async (path) => ({
      exists: () => true,
      data: () => (path === 'users/u1' ? { handle: 'me_1' } : { handles }),
    }));
  });

  it('refuses the 501st author', async () => {
    await expect(api.follow('new_1')).rejects.toMatchObject({ code: 'limit_reached' });
    expect(fb.setDoc).not.toHaveBeenCalled();
  });

  it('still accepts an author who is already in a full list', async () => {
    await api.follow('a_7');
    expect(fb.setDoc).toHaveBeenCalledWith('follows/u1', { handles: ['union', 'a_7'] }, { merge: true });
  });
});

describe('approveCircuit (approval is pinned to the version the admin saw)', () => {
  const txWith = (updatedAt) => ({
    get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ updatedAt }) }),
    update: vi.fn(),
  });

  it('refuses when the owner edited the circuit after the admin opened it', async () => {
    const tx = txWith({ toMillis: () => 200 });
    fb.runTx.mockImplementation((_db, fn) => fn(tx));
    await expect(api.approveCircuit('p1', 100)).rejects.toMatchObject({ code: 'conflict' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('approves when it is still the version the admin saw', async () => {
    const tx = txWith({ toMillis: () => 100 });
    fb.runTx.mockImplementation((_db, fn) => fn(tx));
    await api.approveCircuit('p1', 100);
    expect(tx.update).toHaveBeenCalledWith('projects/p1', expect.objectContaining({ approved: true }));
  });
});

describe('projectFrom (documents are untrusted)', () => {
  const snap = (data) => ({ id: 'p1', data: () => data });

  it('survives a hostile document instead of crashing the page that lists it', () => {
    const p = projectFrom(
      snap({ name: { x: 1 }, tags: ['ok', { x: 1 }, 5], parts: '{not json', wires: '"x"', updatedAt: 'later' }),
    );
    expect(p).toMatchObject({ name: '', tags: ['ok'], parts: [], wires: [], updatedAt: 0 });
  });

  it('turns Firestore timestamps into milliseconds', () => {
    expect(projectFrom(snap({ updatedAt: { toMillis: () => 42 }, parts: '[]', wires: '[]' })).updatedAt).toBe(42);
  });
});
