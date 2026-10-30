import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import { selectModal } from '@/features/ui/uiSlice';
import DiscussionsPage from './pages/DiscussionsPage';
import ThreadPage from './pages/ThreadPage';

vi.mock('@/lib/api', () => ({
  api: {
    threads: vi.fn(),
    thread: vi.fn(),
    createThread: vi.fn(),
    addPost: vi.fn(),
    setDiscussionLike: vi.fn(),
    deletePost: vi.fn(),
    deleteThread: vi.fn(),
    notifications: vi.fn(async () => []),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const signedIn = { auth: authState({ user: signedInUser({ id: 'u-1', handle: 'ada_1' }) }) };
const post = (id, extra) => ({ id, userId: 'u-2', author: 'bob_2', text: `text ${id}`, parentId: null, likeCount: 0, liked: false, createdAt: 1, ...extra });
const thread = {
  id: 't1',
  userId: 'u-2',
  author: 'bob_2',
  title: 'LCD shows blocks',
  body: 'What am I doing wrong?',
  likeCount: 1,
  liked: false,
  createdAt: 1,
  posts: [post('c1'), post('r1', { parentId: 'c1', userId: 'u-1', author: 'ada_1' })],
};

function renderAt(route, preloadedState = signedIn) {
  return renderWithProviders(
    <Routes>
      <Route path="/discussions" element={<DiscussionsPage />} />
      <Route path="/discussions/:id" element={<ThreadPage />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route, preloadedState },
  );
}

describe('DiscussionsPage', () => {
  it('lists threads and starts a new one', async () => {
    api.threads.mockResolvedValue({ items: [thread], cursor: null });
    api.createThread.mockResolvedValue({ id: 't2' });
    api.thread.mockResolvedValue({ ...thread, id: 't2', title: 'New one', posts: [] });
    renderAt('/discussions');
    expect(await screen.findByText('LCD shows blocks')).toBeInTheDocument();
    expect(screen.getByText(/@bob_2 · .* · 1 likes/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('New post'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New one' } });
    fireEvent.change(screen.getByLabelText('Post'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(api.createThread).toHaveBeenCalledWith({ title: 'New one', body: 'Hello' }));
    expect(await screen.findByRole('heading', { name: 'New one' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to log in before posting', async () => {
    api.threads.mockResolvedValue({ items: [], cursor: null });
    renderAt('/discussions', { auth: authState() });
    fireEvent.click(await screen.findByText('New post'));
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});

describe('ThreadPage', () => {
  it('shows the post with comments and nested replies, and adds a reply under a comment', async () => {
    api.thread.mockResolvedValue(thread);
    api.addPost.mockResolvedValue(post('r2', { parentId: 'c1', userId: 'u-1', author: 'ada_1', text: 'Check the contrast pot' }));
    renderAt('/discussions/t1');
    expect(await screen.findByRole('heading', { name: 'LCD shows blocks' })).toBeInTheDocument();
    expect(screen.getByText('text r1').closest('.post-replies')).not.toBeNull();

    fireEvent.click(screen.getAllByText('Reply')[0]);
    const box = screen.getByLabelText('Reply to @bob_2');
    fireEvent.change(box, { target: { value: 'Check the contrast pot' } });
    fireEvent.submit(box.closest('form'));
    expect(await screen.findByText('Check the contrast pot')).toBeInTheDocument();
    expect(api.addPost).toHaveBeenCalledWith('t1', 'Check the contrast pot', 'c1');
  });

  it('likes the thread and a comment, and only offers delete on your own posts', async () => {
    api.thread.mockResolvedValue(thread);
    api.setDiscussionLike.mockResolvedValue({});
    const { store } = renderAt('/discussions/t1');
    await screen.findByRole('heading', { name: 'LCD shows blocks' });
    const likes = screen.getAllByRole('button', { pressed: false }).filter((b) => b.className.includes('like'));
    fireEvent.click(likes[0]);
    await waitFor(() => expect(api.setDiscussionLike).toHaveBeenCalledWith('t1', null, true));
    expect(await screen.findByText('♥ 2')).toBeInTheDocument();

    expect(screen.getAllByText('Delete')).toHaveLength(1); // only Ada's own reply
    fireEvent.click(screen.getByText('Delete'));
    expect(selectModal(store.getState()).type).toBe('confirm');
  });

  it('reports the discussion, naming the comment when one is reported', async () => {
    api.thread.mockResolvedValue(thread);
    const { store } = renderAt('/discussions/t1');
    await screen.findByRole('heading', { name: 'LCD shows blocks' });
    const reports = screen.getAllByText('Report'); // thread, comment c1 (Bob's); not Ada's own reply
    expect(reports).toHaveLength(2);
    fireEvent.click(reports[0]);
    expect(selectModal(store.getState())).toMatchObject({ type: 'report', props: { item: { id: 'thread:t1' }, note: '' } });
    fireEvent.click(reports[1]);
    expect(selectModal(store.getState()).props.note).toBe('Comment by @bob_2 "text c1": ');
  });

  it('says so when a thread is gone', async () => {
    api.thread.mockResolvedValue(null);
    renderAt('/discussions/nope');
    expect(await screen.findByText(/removed or never existed/)).toBeInTheDocument();
  });

  it('still shows a reply whose comment was deleted', async () => {
    api.thread.mockResolvedValue({ ...thread, posts: [post('orphan', { parentId: 'gone', text: 'Still here' })] });
    renderAt('/discussions/t1');
    expect(await screen.findByText('Still here')).toBeInTheDocument();
    expect(screen.getByText('1 comments')).toBeInTheDocument();
  });
});
