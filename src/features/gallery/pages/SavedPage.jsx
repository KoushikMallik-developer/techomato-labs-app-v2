import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import GalleryCard from '@/components/GalleryCard';
import { api } from '@/lib/api';

/** The Community circuits the user saved with "Save" on a circuit's page. */
export default function SavedPage() {
  const [items, setItems] = useState(null);
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    api.savedItems().then(
      (r) => {
        setItems(r.items);
        setMissing(r.missing);
      },
      () => setItems([]),
    );
  }, []);

  async function onForget() {
    await api.forgetBookmarks(missing).then(() => setMissing([]), () => {});
  }

  async function onLike(id) {
    const item = items.find((i) => i.id === id);
    try {
      const res = item.liked ? await api.unlike(id) : await api.like(id);
      setItems((list) => list.map((i) => (i.id === id ? { ...i, ...res } : i)));
    } catch {
      // the detail page shows why; a saved list is not the place for errors
    }
  }

  return (
    <AppShell title="Saved circuits">
      <div className="head">
        <div>
          <p>Circuits you saved from Community Circuits.</p>
          {missing.length > 0 && (
            <p className="small muted">
              {missing.length} saved {missing.length === 1 ? 'circuit is' : 'circuits are'} not shared right now
              (removed, or back in review after an edit).{' '}
              <button className="editor-link" onClick={onForget}>
                Forget {missing.length === 1 ? 'it' : 'them'}
              </button>
            </p>
          )}
        </div>
      </div>
      {items === null ? (
        <p className="muted">Loading&hellip;</p>
      ) : items.length === 0 ? (
        <div className="empty glass">
          <h2>Nothing saved yet</h2>
          <p className="muted">Open a circuit in Community Circuits and press Save.</p>
        </div>
      ) : (
        <div className="cards">
          {items.map((item) => (
            <GalleryCard key={item.id} item={item} liked={item.liked} onLike={onLike} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
