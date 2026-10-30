import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import ProfilePage from './ProfilePage';
import SavedPage from './SavedPage';

vi.mock('@/lib/api', () => ({
  api: {
    gallery: vi.fn(),
    following: vi.fn(async () => []),
    follow: vi.fn(),
    savedItems: vi.fn(),
    forgetBookmarks: vi.fn(async () => {}),
    like: vi.fn(),
    unlike: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const card = (id, likeCount) => ({ id, name: `C ${id}`, author: 'ada_1', tags: [], parts: [], wires: [], likeCount, publishedAt: 1 });

function renderProfile(preloadedState) {
  return renderWithProviders(
    <Routes>
      <Route path="/u/:handle" element={<ProfilePage />} />
    </Routes>,
    { route: '/u/ada_1', preloadedState },
  );
}

describe('ProfilePage', () => {
  it("lists the author's circuits with a like total, pages, and lets you follow", async () => {
    api.gallery.mockResolvedValueOnce({ items: [card('a', 3), card('b', 4)], cursor: 9 });
    api.gallery.mockResolvedValueOnce({ items: [card('c', 1)], cursor: null });
    api.follow.mockResolvedValue({ handle: 'ada_1', following: true });
    renderProfile({ auth: authState({ user: signedInUser({ handle: 'me_1' }) }) });
    expect(await screen.findByText('2+ shared circuits · 7 likes')).toBeInTheDocument();
    expect(api.gallery).toHaveBeenCalledWith({ author: 'ada_1' });

    fireEvent.click(screen.getByText('Load more'));
    expect(await screen.findByText('3 shared circuits · 8 likes')).toBeInTheDocument();
    expect(api.gallery).toHaveBeenLastCalledWith({ author: 'ada_1', after: 9 });

    fireEvent.click(screen.getByText('Follow'));
    await waitFor(() => expect(api.follow).toHaveBeenCalledWith('ada_1'));
  });

  it('shows no follow button on your own page', async () => {
    api.gallery.mockResolvedValue({ items: [], cursor: null });
    renderProfile({ auth: authState({ user: signedInUser({ handle: 'ada_1' }) }) });
    expect(await screen.findByText('No shared circuits')).toBeInTheDocument();
    expect(screen.queryByText('Follow')).not.toBeInTheDocument();
  });
});

describe('SavedPage', () => {
  it('lists saved circuits, or says how to save one', async () => {
    api.savedItems.mockResolvedValueOnce({ items: [card('a', 3)], missing: [] });
    const { unmount } = renderWithProviders(<SavedPage />);
    expect(await screen.findByText('C a')).toBeInTheDocument();
    unmount();
    api.savedItems.mockResolvedValueOnce({ items: [], missing: [] });
    renderWithProviders(<SavedPage />);
    expect(await screen.findByText('Nothing saved yet')).toBeInTheDocument();
  });

describe('SavedPage — circuits that are gone', () => {
  it('says how many are unavailable and forgets them on request', async () => {
    api.savedItems.mockResolvedValueOnce({ items: [], missing: ['x', 'y'] });
    renderWithProviders(<SavedPage />);
    fireEvent.click(await screen.findByText('Forget them'));
    await waitFor(() => expect(api.forgetBookmarks).toHaveBeenCalledWith(['x', 'y']));
    await waitFor(() => expect(screen.queryByText(/not shared right now/)).not.toBeInTheDocument());
  });
});
});
