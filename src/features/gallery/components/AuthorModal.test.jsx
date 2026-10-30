import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, authState, signedInUser, galleryState } from '@/test-utils';
import { api } from '@/lib/api';
import AuthorModal from './AuthorModal';

vi.mock('@/lib/api', () => ({
  api: { gallery: vi.fn(), following: vi.fn(), follow: vi.fn(), unfollow: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.gallery.mockResolvedValue({ items: [], cursor: null });
  api.following.mockResolvedValue([]);
});

describe('AuthorModal (signed out)', () => {
  it('shows the author\'s handle and their shared circuits, with no follow button', async () => {
    api.gallery.mockResolvedValue({ items: [{ id: 'g-1', name: 'Blink' }], cursor: null });
    renderWithProviders(<AuthorModal handle="ada_maker" close={() => {}} />);
    expect(screen.getByText('@ada_maker')).toBeInTheDocument();
    expect(await screen.findByText('Blink')).toHaveAttribute('href', '/community/g-1');
    expect(screen.queryByText('Follow')).not.toBeInTheDocument();
    expect(api.gallery).toHaveBeenCalledWith({ author: 'ada_maker' });
  });

  it('shows a placeholder when the author has nothing shared', async () => {
    renderWithProviders(<AuthorModal handle="ada_maker" close={() => {}} />);
    expect(await screen.findByText('Nothing shared yet.')).toBeInTheDocument();
  });

  it('calls close() when Close is clicked', () => {
    const close = vi.fn();
    renderWithProviders(<AuthorModal handle="ada_maker" close={close} />);
    fireEvent.click(screen.getByText('Close'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('AuthorModal (signed in)', () => {
  const preloadedState = { auth: authState({ user: signedInUser() }) };

  it('shows a Follow button when not yet following', async () => {
    renderWithProviders(<AuthorModal handle="ada_maker" close={() => {}} />, { preloadedState });
    await waitFor(() => expect(api.following).toHaveBeenCalled());
    expect(screen.getByText('Follow')).toBeInTheDocument();
  });

  it('shows a Following state and unfollows on click', async () => {
    api.following.mockResolvedValue(['ada_maker']);
    api.unfollow.mockResolvedValue({ handle: 'ada_maker', following: false });
    renderWithProviders(<AuthorModal handle="ada_maker" close={() => {}} />, {
      preloadedState: { ...preloadedState, gallery: galleryState() },
    });
    expect(await screen.findByText('Following')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Following'));
    await waitFor(() => expect(screen.getByText('Follow')).toBeInTheDocument());
    expect(api.unfollow).toHaveBeenCalledWith('ada_maker');
  });

  it('follows on click when not yet following', async () => {
    api.follow.mockResolvedValue({ handle: 'ada_maker', following: true });
    renderWithProviders(<AuthorModal handle="ada_maker" close={() => {}} />, { preloadedState });
    const followBtn = await screen.findByText('Follow');
    fireEvent.click(followBtn);
    await waitFor(() => expect(screen.getByText('Following')).toBeInTheDocument());
    expect(api.follow).toHaveBeenCalledWith('ada_maker');
  });

  it('closes when clicking a shared circuit link', async () => {
    api.gallery.mockResolvedValue({ items: [{ id: 'g-1', name: 'Blink' }], cursor: null });
    const close = vi.fn();
    renderWithProviders(<AuthorModal handle="ada_maker" close={close} />, { preloadedState });
    fireEvent.click(await screen.findByText('Blink'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
