import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import DetailPage from './DetailPage';
import { selectModal } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: {
    item: vi.fn(),
    comments: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
    remix: vi.fn(),
    addComment: vi.fn(),
    deleteComment: vi.fn(),
    bookmarks: vi.fn(async () => []),
    setBookmark: vi.fn(),
  },
}));

const item = {
  id: 'g-1',
  ownerId: 'someone-else',
  name: 'Garage Sensor',
  author: 'hana_builds',
  description: 'Keeps you from hitting the wall.',
  tags: ['sensors'],
  parts: [
    { id: 'led-1', type: 'led', x: 0, y: 0, rot: 0, props: { color: 'red' } },
    { id: 'led-2', type: 'led', x: 20, y: 0, rot: 0, props: { color: 'green' } },
    { id: 'res-1', type: 'resistor', x: 40, y: 0, rot: 0, props: { ohms: 220 } },
  ],
  wires: [
    { id: 'w-1', a: 'led-1.A', b: 'led-2.A', color: '#ffd166' },
    { id: 'w-2', a: 'led-1.K', b: 'res-1.1', color: '#4cc9f0' },
  ],
  code: 'void setup() {}\nvoid loop() {}',
  liked: false,
  likeCount: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.comments.mockResolvedValue([]);
});

function renderDetail(preloadedState) {
  return renderWithProviders(
    <Routes>
      <Route path="/community/:id" element={<DetailPage />} />
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/editor/:id" element={<div>Editor page</div>} />
    </Routes>,
    { route: '/community/g-1', preloadedState },
  );
}

describe('DetailPage', () => {
  it('shows a loading state, then the circuit details', async () => {
    api.item.mockResolvedValue(item);
    renderDetail();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Garage Sensor' })).toBeInTheDocument();
    expect(screen.getByText('Keeps you from hitting the wall.')).toBeInTheDocument();
    expect(screen.getByText('sensors')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2 wires')).toBeInTheDocument();
  });

  it('shows "Open a copy" for a non-owner, and remixes into a new editor project', async () => {
    api.item.mockResolvedValue(item);
    api.remix.mockResolvedValue({ id: 'p-new' });
    renderDetail({ auth: authState({ user: signedInUser({ id: 'someone-signed-in' }) }) });
    await screen.findByRole('heading', { name: 'Garage Sensor' });
    fireEvent.click(screen.getByText('Open a copy'));
    expect(await screen.findByText('Editor page')).toBeInTheDocument();
    expect(api.remix).toHaveBeenCalledWith('g-1');
  });

  it('shows "Open in editor" for the owner instead of remixing', async () => {
    api.item.mockResolvedValue(item);
    renderDetail({ auth: authState({ user: signedInUser({ id: 'someone-else' }) }) });
    await screen.findByRole('heading', { name: 'Garage Sensor' });
    expect(screen.getByText('Open in editor')).toHaveAttribute('href', '/editor/g-1');
    expect(screen.queryByText('Open a copy')).not.toBeInTheDocument();
  });

  it('redirects a signed-out visitor to /login when liking or remixing', async () => {
    api.item.mockResolvedValue(item);
    renderDetail();
    await screen.findByRole('heading', { name: 'Garage Sensor' });
    fireEvent.click(screen.getByText('7').closest('button'));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('likes the circuit when signed in', async () => {
    api.item.mockResolvedValue(item);
    api.like.mockResolvedValue({ liked: true, likeCount: 8 });
    renderDetail({ auth: authState({ user: signedInUser() }) });
    await screen.findByRole('heading', { name: 'Garage Sensor' });
    fireEvent.click(screen.getByText('7').closest('button'));
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
  });

  it('copies the share link to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    api.item.mockResolvedValue(item);
    renderDetail();
    await screen.findByRole('heading', { name: 'Garage Sensor' });
    fireEvent.click(screen.getByText('Copy link'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/community/g-1`));
  });

  it('falls back to window.prompt when the clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => {});
    api.item.mockResolvedValue(item);
    renderDetail();
    await screen.findByRole('heading', { name: 'Garage Sensor' });
    fireEvent.click(screen.getByText('Copy link'));
    await waitFor(() => expect(promptSpy).toHaveBeenCalledWith('Copy this link:', `${window.location.origin}/community/g-1`));
    promptSpy.mockRestore();
  });

  it('shows the part counts grouped by type, ignoring breadboard/arduino', async () => {
    api.item.mockResolvedValue({
      ...item,
      parts: [
        { id: 'bb', type: 'breadboard', x: 0, y: 0, rot: 0, props: {} },
        { id: 'ard', type: 'arduino', x: 0, y: 0, rot: 0, props: {} },
        { id: 'led-1', type: 'led', x: 0, y: 0, rot: 0, props: { color: 'red' } },
        { id: 'led-2', type: 'led', x: 20, y: 0, rot: 0, props: { color: 'green' } },
      ],
      wires: [],
    });
    renderDetail();
    expect(await screen.findByText(/2×/)).toBeInTheDocument();
  });

  it('saves a circuit for later and opens the report dialog', async () => {
    api.item.mockResolvedValue(item);
    api.bookmarks.mockResolvedValue([]);
    api.setBookmark.mockResolvedValue({ id: 'g-1', saved: true });
    const { store } = renderDetail({ auth: authState({ user: signedInUser() }) });
    fireEvent.click(await screen.findByText('Save'));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(api.setBookmark).toHaveBeenCalledWith('g-1', true);
    fireEvent.click(screen.getByText('Report'));
    expect(selectModal(store.getState())).toMatchObject({ type: 'report', props: { item: { id: 'g-1' } } });
  });

  it('sends a signed-out visitor to log in before saving', async () => {
    api.item.mockResolvedValue(item);
    renderDetail();
    fireEvent.click(await screen.findByText('Save'));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
