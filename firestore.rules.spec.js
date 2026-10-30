// @vitest-environment node
// Run with `npm run test:rules` (needs the Firestore emulator); skipped in plain `npm test`.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getCountFromServer, documentId, getDoc, getDocs, increment, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const project = {
  ownerId: 'alicexyz1234', author: 'alice_1234', name: 'Blink', description: '', tags: [], folder: null,
  parts: '[]', wires: '[]', code: '', published: true, approved: true, seed: false, likeCount: 0,
  publishedAt: 1, approvedAt: 1, createdAt: 1, updatedAt: 1,
};

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('firestore.rules', () => {
  let env;
  let alice;
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'rules-test',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', 'p1'), project);
      await setDoc(doc(ctx.firestore(), 'users', 'alicexyz1234'), { name: 'Alice', handle: 'alice_1234', avatar: '' });
    });
    alice = env.authenticatedContext('alicexyz1234', { email_verified: true }).firestore();
  });
  afterAll(() => env.cleanup());

  it('lets the owner move an approved circuit between folders', async () => {
    await assertSucceeds(updateDoc(doc(alice, 'projects', 'p1'), { folder: 'f1', updatedAt: serverTimestamp() }));
  });

  it('blocks editing an approved circuit without sending it back to review', async () => {
    await assertFails(updateDoc(doc(alice, 'projects', 'p1'), { code: 'evil()', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(alice, 'projects', 'p1'), { code: 'ok()', approved: false, approvedAt: null, updatedAt: serverTimestamp() }));
  });

  it('blocks owners approving their own circuit or forging likes', async () => {
    await assertFails(updateDoc(doc(alice, 'projects', 'p1'), { approved: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(alice, 'projects', 'p1'), { likeCount: 5, updatedAt: serverTimestamp() }));
  });

  it('refuses an owner edit that keeps the old updatedAt, so approvals cannot be pinned to stale content', async () => {
    await assertFails(updateDoc(doc(alice, 'projects', 'p1'), { code: 'swapped()', approved: false, updatedAt: 1 }));
  });

  it('refuses project lists without a limit', async () => {
    const anon = env.unauthenticatedContext().firestore();
    const approved = query(collection(anon, 'projects'), where('approved', '==', true));
    await assertFails(getDocs(approved));
    await assertSucceeds(getDocs(query(approved, limit(10))));
  });

  it('refuses comment lists without a limit', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', 'pa'), project);
    });
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, 'projects', 'pa', 'comments')));
    await assertSucceeds(getDocs(query(collection(anon, 'projects', 'pa', 'comments'), limit(50))));
  });

  it('lets a user look up their own likes by id, and nobody else', async () => {
    const likes = (ctx) => query(collection(ctx, 'users', 'alicexyz1234', 'likes'), where(documentId(), 'in', ['pa']));
    await assertSucceeds(getDocs(likes(alice)));
    await assertFails(getDocs(likes(env.authenticatedContext('bob').firestore())));
  });

  it('refuses comment and circuit timestamps that would sort to the top', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', 'pc'), project);
      await setDoc(doc(ctx.firestore(), 'users', 'carolxyz9012'), { name: 'Carol', handle: 'carol_9012', avatar: '' });
      await setDoc(doc(ctx.firestore(), 'projects', 'pz'), { ...project, approved: false, published: false, publishedAt: null });
    });
    const carol = env.authenticatedContext('carolxyz9012', { email_verified: true }).firestore();
    const comment = (createdAt) => {
      const batch = writeBatch(carol);
      batch.set(doc(carol, 'projects', 'pc', 'comments', 'c1'), { userId: 'carolxyz9012', name: 'Carol', text: 'hi', createdAt });
      batch.set(doc(carol, 'limits', 'carolxyz9012'), { comment: serverTimestamp(), commentId: 'c1' }, { merge: true });
      return batch.commit();
    };
    await assertFails(comment('z'));
    await assertFails(comment(9e15));
    await assertSucceeds(comment(Date.now()));

    const publish = (publishedAt) =>
      updateDoc(doc(alice, 'projects', 'pz'), { publishedAt, updatedAt: serverTimestamp() });
    await assertFails(publish('z'));
    await assertFails(publish(9e15));
    await assertSucceeds(publish(Date.now()));
  });

  it('needs a verified email to comment or to share a circuit', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', 'pf'), project);
      await setDoc(doc(ctx.firestore(), 'users', 'finnxyz4444'), { name: 'Finn', handle: 'finn_4444', avatar: '' });
      await setDoc(doc(ctx.firestore(), 'projects', 'pf2'), {
        ...project, ownerId: 'finnxyz4444', author: 'finn_4444', approved: false, published: false, publishedAt: null,
      });
    });
    const unverified = env.authenticatedContext('finnxyz4444').firestore();
    const verified = env.authenticatedContext('finnxyz4444', { email_verified: true }).firestore();
    const comment = (db, id) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', 'pf', 'comments', id), { userId: 'finnxyz4444', name: 'Finn', text: 'hi', createdAt: Date.now() });
      batch.set(doc(db, 'limits', 'finnxyz4444'), { comment: serverTimestamp(), commentId: id }, { merge: true });
      return batch.commit();
    };
    await assertFails(comment(unverified, 'c1'));
    await assertSucceeds(comment(verified, 'c2'));

    const share = (db) =>
      updateDoc(doc(db, 'projects', 'pf2'), { published: true, publishedAt: Date.now(), updatedAt: serverTimestamp() });
    await assertFails(share(unverified));
    await assertSucceeds(share(verified));
  });

  it('lets an admin disable and enable a user; a disabled user can read but not write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'adminxyz0000'), { role: 'admin' });
      await setDoc(doc(ctx.firestore(), 'users', 'gabexyz5555'), { name: 'Gabe', handle: 'gabe_5555', avatar: '' });
      await setDoc(doc(ctx.firestore(), 'projects', 'pg'), {
        ...project, ownerId: 'gabexyz5555', author: 'gabe_5555', approved: false, published: false, publishedAt: null,
      });
    });
    const admin = env.authenticatedContext('adminxyz0000').firestore();
    const gabe = env.authenticatedContext('gabexyz5555', { email_verified: true }).firestore();
    const folder = { ownerId: 'gabexyz5555', name: 'Sensors', createdAt: 1 };

    await assertSucceeds(setDoc(doc(gabe, 'folders', 'gabexyz5555_1'), folder)); // fine while enabled
    await assertFails(setDoc(doc(gabe, 'disabledUsers', 'gabexyz5555'), { at: 1 })); // only admins disable
    await assertFails(setDoc(doc(admin, 'disabledUsers', 'adminxyz0000'), { at: 1 })); // admins cannot be disabled

    await assertSucceeds(setDoc(doc(admin, 'disabledUsers', 'gabexyz5555'), { at: Date.now() }));
    await assertSucceeds(getDoc(doc(gabe, 'disabledUsers', 'gabexyz5555'))); // so the app can explain
    await assertFails(setDoc(doc(gabe, 'folders', 'gabexyz5555_2'), folder));
    await assertFails(setDoc(doc(gabe, 'follows', 'gabexyz5555'), { handles: ['a_1'] }));
    await assertFails(updateDoc(doc(gabe, 'users', 'gabexyz5555'), { name: 'Gabriel', nameLower: 'gabriel' }));
    await assertFails(updateDoc(doc(gabe, 'projects', 'pg'), { name: 'Edited', updatedAt: serverTimestamp() }));
    const stamp = writeBatch(gabe);
    stamp.set(doc(gabe, 'limits', 'gabexyz5555'), { comment: serverTimestamp(), commentId: 'cx' }, { merge: true });
    await assertFails(stamp.commit()); // no stamp, so no comments and no new circuits

    await assertSucceeds(deleteDoc(doc(admin, 'disabledUsers', 'gabexyz5555')));
    await assertSucceeds(updateDoc(doc(gabe, 'users', 'gabexyz5555'), { name: 'Gabriel', nameLower: 'gabriel' }));
  });

  it('lets an admin list users, and nobody else', async () => {
    const admin = env.authenticatedContext('adminxyz0000').firestore();
    const nobody = env.authenticatedContext('gabexyz5555').firestore();
    const newest = (db) => query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
    await assertSucceeds(getDocs(newest(admin)));
    await assertFails(getDocs(newest(nobody)));
    await assertFails(getDocs(query(collection(admin, 'users'), orderBy('createdAt', 'desc')))); // limit required
  });

  it('keeps the searchable name in step with the name, and lets an admin count a user\'s circuits', async () => {
    const alice2 = env.authenticatedContext('gabexyz5555').firestore();
    await assertFails(updateDoc(doc(alice2, 'users', 'gabexyz5555'), { name: 'Gabriel', nameLower: 'someone else' }));
    await assertSucceeds(updateDoc(doc(alice2, 'users', 'gabexyz5555'), { name: 'Gabe', nameLower: 'gabe' }));

    const admin = env.authenticatedContext('adminxyz0000').firestore();
    // Counting ALL of someone's circuits (drafts included) is for admins; approved ones are public anyway.
    const all = (db) => query(collection(db, 'projects'), where('ownerId', '==', 'alicexyz1234'), limit(10));
    await assertSucceeds(getCountFromServer(all(admin)));
    await assertFails(getCountFromServer(all(alice2)));
  });

  it('gives each user only three folder slots', async () => {
    const folder = { ownerId: 'alicexyz1234', name: 'Sensors', createdAt: 1 };
    await assertSucceeds(setDoc(doc(alice, 'folders', 'alicexyz1234_3'), folder));
    await assertFails(setDoc(doc(alice, 'folders', 'alicexyz1234_4'), folder));
    await assertFails(setDoc(doc(alice, 'folders', 'anything-else'), folder));
  });

  it('caps the follow list at 500', async () => {
    const handles = (n) => Array.from({ length: n }, (_, i) => `a_${i}`);
    await assertSucceeds(setDoc(doc(alice, 'follows', 'alicexyz1234'), { handles: handles(500) }));
    await assertFails(setDoc(doc(alice, 'follows', 'alicexyz1234'), { handles: handles(501) }));
  });

  // The three tests below replay what the app really sends (see createProfile, setLike, approveCircuit in
  // src/lib/api.js). If you change either side, these are what tell you signup/likes/approval still work.
  it('accepts the exact signup batch: handle, profile, starter circuit and limits together', async () => {
    const dan = env.authenticatedContext('danxyz7777', { email: 'Dan@Example.com' }).firestore();
    const t = Date.now();
    const profile = (email) => ({ name: 'Dan', nameLower: 'dan', handle: 'dan_7777', avatar: '', createdAt: t, email });
    const signup = (email) => {
      const b = writeBatch(dan);
      b.set(doc(dan, 'handles', 'dan_7777'), { uid: 'danxyz7777' });
      b.set(doc(dan, 'users', 'danxyz7777'), profile(email));
      return b;
    };
    await assertFails(signup('someone.else@example.com').commit()); // the stored email must be the login's own
    // Missing or odd createdAt/email would hide the account from the admin's newest-users list.
    const withProfile = (data) => {
      const b = writeBatch(dan);
      b.set(doc(dan, 'handles', 'dan_7777'), { uid: 'danxyz7777' });
      b.set(doc(dan, 'users', 'danxyz7777'), data);
      return b.commit();
    };
    const { createdAt: _c, ...noCreatedAt } = profile('dan@example.com');
    const { email: _e, ...noEmail } = profile('dan@example.com');
    await assertFails(withProfile(noCreatedAt));
    await assertFails(withProfile({ ...profile('dan@example.com'), createdAt: 'z' }));
    await assertFails(withProfile({ ...profile('dan@example.com'), createdAt: 9e15 }));
    await assertFails(withProfile(noEmail));
    const batch = writeBatch(dan);
    batch.set(doc(dan, 'handles', 'dan_7777'), { uid: 'danxyz7777' });
    batch.set(doc(dan, 'users', 'danxyz7777'), profile('dan@example.com'));
    batch.set(doc(dan, 'projects', 'starter'), {
      ownerId: 'danxyz7777', author: 'dan_7777', name: 'My first circuit', description: '', tags: [], folder: null,
      parts: '[]', wires: '[]', code: '', published: false, approved: false, seed: false, likeCount: 0,
      publishedAt: null, approvedAt: null, createdAt: t, updatedAt: t,
    });
    batch.set(
      doc(dan, 'limits', 'danxyz7777'),
      { project: serverTimestamp(), projectId: 'starter', projectCount: increment(1) },
      { merge: true },
    );
    await assertSucceeds(batch.commit());
  });

  it('accepts a like and an unlike as the app sends them, and refuses a forged count', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', 'pl'), project);
    });
    const erin = env.authenticatedContext('erinxyz1111').firestore();
    const likeRef = doc(erin, 'users', 'erinxyz1111', 'likes', 'pl');
    const projectRef = doc(erin, 'projects', 'pl');
    await assertSucceeds(
      runTransaction(erin, async (tx) => {
        await tx.get(projectRef);
        tx.set(likeRef, { createdAt: 1 });
        tx.update(projectRef, { likeCount: increment(1) });
      }),
    );
    await assertSucceeds(
      runTransaction(erin, async (tx) => {
        await tx.get(projectRef);
        tx.delete(likeRef);
        tx.update(projectRef, { likeCount: increment(-1) });
      }),
    );
    await assertFails(updateDoc(projectRef, { likeCount: increment(5) }));
  });

  it('lets an admin approve a pending circuit, but not edit it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'adminxyz0000'), { role: 'admin' });
      await setDoc(doc(ctx.firestore(), 'projects', 'pp'), { ...project, approved: false, published: true });
    });
    const admin = env.authenticatedContext('adminxyz0000').firestore();
    await assertFails(updateDoc(doc(admin, 'projects', 'pp'), { code: 'sneaky()' }));
    await assertSucceeds(updateDoc(doc(admin, 'projects', 'pp'), { approved: true, approvedAt: Date.now() }));
  });

  it('lets a user read only their own limits document', async () => {
    await assertSucceeds(getDoc(doc(alice, 'limits', 'alicexyz1234')));
    await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'limits', 'alicexyz1234')));
  });

  it('only allows handles tied to the owner uid', async () => {
    await assertFails(setDoc(doc(alice, 'handles', 'techomato'), { uid: 'alicexyz1234' }));
    await assertSucceeds(setDoc(doc(alice, 'handles', 'alice_1234'), { uid: 'alicexyz1234' }));
  });

  it('throttles repeated comment stamps', async () => {
    await assertSucceeds(setDoc(doc(alice, 'limits', 'alicexyz1234'), { comment: serverTimestamp(), commentId: 'c1' }, { merge: true }));
    await assertFails(setDoc(doc(alice, 'limits', 'alicexyz1234'), { comment: serverTimestamp(), commentId: 'c2' }, { merge: true }));
  });

  it('lets one stamp pay for one circuit, not a batch of them', async () => {
    const fresh = { ...project, approved: false, published: false };
    const create = (ids) => {
      const batch = writeBatch(alice);
      ids.forEach((id) => batch.set(doc(alice, 'projects', id), fresh));
      batch.set(doc(alice, 'limits', 'alicexyz1234'), { project: serverTimestamp(), projectId: ids[0], projectCount: increment(1) }, { merge: true });
      return batch.commit();
    };
    await assertFails(create(['n1', 'n2']));
    await assertSucceeds(create(['n1']));
  });

  it('caps a user at 5 circuits and frees a slot when one is deleted', async () => {
    const bob = env.authenticatedContext('bobxyz5678').firestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'bobxyz5678'), { name: 'Bob', handle: 'bob_5678', avatar: '' });
      await setDoc(doc(ctx.firestore(), 'projects', 'b1'), { ...project, ownerId: 'bobxyz5678', author: 'bob_5678' });
      await setDoc(doc(ctx.firestore(), 'limits', 'bobxyz5678'), { projectCount: 5 });
    });
    const mine = { ...project, ownerId: 'bobxyz5678', author: 'bob_5678', approved: false, published: false };
    const add = () => {
      const batch = writeBatch(bob);
      batch.set(doc(bob, 'projects', 'b2'), mine);
      batch.set(
        doc(bob, 'limits', 'bobxyz5678'),
        { project: serverTimestamp(), projectId: 'b2', projectCount: increment(1) },
        { merge: true },
      );
      return batch.commit();
    };
    await assertFails(add());
    const del = writeBatch(bob);
    del.delete(doc(bob, 'projects', 'b1'));
    del.set(doc(bob, 'limits', 'bobxyz5678'), { removedId: 'b1', projectCount: increment(-1) }, { merge: true });
    await assertSucceeds(del.commit());
    await assertSucceeds(add());
    await assertFails(setDoc(doc(bob, 'limits', 'bobxyz5678'), { projectCount: 0 }, { merge: true }));
  });

  it('allows only the profile handle', async () => {
    await assertFails(setDoc(doc(alice, 'handles', 'spam_1234'), { uid: 'alicexyz1234' }));
  });

  it('hides a profile from other users', async () => {
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'users', 'alicexyz1234')));
  });
});
