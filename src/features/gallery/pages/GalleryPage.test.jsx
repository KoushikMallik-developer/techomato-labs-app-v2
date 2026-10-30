import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import GalleryPage from './GalleryPage';

vi.mock('@/lib/api', () => ({
  api: { gallery: vi.fn(), like: vi.fn(), unlike: vi.fn() },
}));

const items = [
  { id: 'g-1', name: 'Garage Sensor', author: 'hana_builds', tags: [], liked: false, likeCount: 5, parts: [], wires: [] },
  { id: 'g-2', name: 'Blink', author: 'ada_maker', tags: [], liked: true, likeCount: 2, parts: [], wires: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
});

function renderGallery(preloadedState) {
  return renderWithProviders(
    <Routes>
      <Route path="/community" element={<GalleryPage />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route: '/community', preloadedState },
  );
}

describe('GalleryPage', () => {
  it('shows a loading state, then the cards', async () => {
    api.gallery.mockResolvedValue(items);
    renderGallery();
    expect(await screen.findByText('Garage Sensor')).toBeInTheDocument();
    expect(screen.getByText('Blink')).toBeInTheDocument();
  });

  it('shows an empty state when there are no results', async () => {
    api.gallery.mockResolvedValue([]);
    renderGallery();
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });

  it('re-fetches as the search box changes', async () => {
    api.gallery.mockResolvedValue([]);
    renderGallery();
    await waitFor(() => expect(api.gallery).toHaveBeenCalledWith({ q: '', tag: '', sort: 'popular' }));
    fireEvent.change(screen.getByPlaceholderText('Search Community Circuits…'), { target: { value: 'sensor' } });
    await waitFor(() => expect(api.gallery).toHaveBeenCalledWith({ q: 'sensor', tag: '', sort: 'popular' }));
  });

  it('re-fetches when the sort changes', async () => {
    api.gallery.mockResolvedValue([]);
    renderGallery();
    await waitFor(() => expect(api.gallery).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('Most liked'), { target: { value: 'new' } });
    await waitFor(() => expect(api.gallery).toHaveBeenCalledWith({ q: '', tag: '', sort: 'new' }));
  });

  it('filters by tag when a tag chip is clicked', async () => {
    api.gallery.mockResolvedValue([]);
    renderGallery();
    await waitFor(() => expect(api.gallery).toHaveBeenCalled());
    fireEvent.click(screen.getByText('beginner'));
    await waitFor(() => expect(api.gallery).toHaveBeenCalledWith({ q: '', tag: 'beginner', sort: 'popular' }));
    expect(screen.getByText('beginner').className).toContain('on');
  });

  it('only shows the Following chip when signed in', async () => {
    api.gallery.mockResolvedValue([]);
    renderGallery();
    await waitFor(() => expect(api.gallery).toHaveBeenCalled());
    expect(screen.queryByText('Following')).not.toBeInTheDocument();

    renderGallery({ auth: authState({ user: signedInUser() }) });
    expect(await screen.findAllByText('Following')).not.toHaveLength(0);
  });

  it('redirects a signed-out visitor to /login when liking', async () => {
    api.gallery.mockResolvedValue(items);
    renderGallery();
    fireEvent.click((await screen.findAllByText('5'))[0]);
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(api.like).not.toHaveBeenCalled();
  });

  it('likes an item when signed in', async () => {
    api.gallery.mockResolvedValue(items);
    api.like.mockResolvedValue({ liked: true, likeCount: 6 });
    renderGallery({ auth: authState({ user: signedInUser() }) });
    const likeBtn = (await screen.findAllByText('5'))[0].closest('button');
    fireEvent.click(likeBtn);
    await waitFor(() => expect(api.like).toHaveBeenCalledWith('g-1'));
  });
});
