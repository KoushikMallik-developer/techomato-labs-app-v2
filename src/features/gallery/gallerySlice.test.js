import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import galleryReducer, {
  fetchGallery,
  toggleLike,
  fetchFollowing,
  toggleFollow,
  fetchDetail,
  addComment,
  deleteComment,
  remixItem,
  setQuery,
  setTag,
  setSort,
  selectGalleryState,
  selectFollowing,
  selectIsFollowing,
} from './gallerySlice';

vi.mock('@/lib/api', () => ({
  api: {
    gallery: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
    following: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn(),
    item: vi.fn(),
    comments: vi.fn(),
    addComment: vi.fn(),
    deleteComment: vi.fn(),
    remix: vi.fn(),
  },
}));

function makeStore() {
  return configureStore({ reducer: { gallery: galleryReducer } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gallerySlice', () => {
  it('fetchGallery.fulfilled sends the current q/tag/sort and stores the results', async () => {
    api.gallery.mockResolvedValue([{ id: 'g-1', liked: false, likeCount: 3 }]);
    const store = makeStore();
    store.dispatch(setQuery('sensor'));
    store.dispatch(setTag('sensors'));
    store.dispatch(setSort('new'));
    await store.dispatch(fetchGallery());
    expect(api.gallery).toHaveBeenCalledWith({ q: 'sensor', tag: 'sensors', sort: 'new' });
    expect(selectGalleryState(store.getState()).items).toEqual([{ id: 'g-1', liked: false, likeCount: 3 }]);
  });

  it('toggleLike calls the like endpoint when the item is not yet liked, and patches the item in place', async () => {
    api.gallery.mockResolvedValue([{ id: 'g-1', liked: false, likeCount: 3 }]);
    api.like.mockResolvedValue({ liked: true, likeCount: 4 });
    const store = makeStore();
    await store.dispatch(fetchGallery());
    await store.dispatch(toggleLike('g-1'));
    expect(api.like).toHaveBeenCalledWith('g-1');
    expect(api.unlike).not.toHaveBeenCalled();
    const item = selectGalleryState(store.getState()).items[0];
    expect(item.liked).toBe(true);
    expect(item.likeCount).toBe(4);
  });

  it('toggleLike calls the unlike endpoint when the item is already liked', async () => {
    api.gallery.mockResolvedValue([{ id: 'g-1', liked: true, likeCount: 4 }]);
    api.unlike.mockResolvedValue({ liked: false, likeCount: 3 });
    const store = makeStore();
    await store.dispatch(fetchGallery());
    await store.dispatch(toggleLike('g-1'));
    expect(api.unlike).toHaveBeenCalledWith('g-1');
    expect(api.like).not.toHaveBeenCalled();
    expect(selectGalleryState(store.getState()).items[0].liked).toBe(false);
  });

  it('toggleLike also patches the detail record when it is the item currently open', async () => {
    api.item.mockResolvedValue({ id: 'g-1', liked: false, likeCount: 1 });
    api.comments.mockResolvedValue([]);
    api.like.mockResolvedValue({ liked: true, likeCount: 2 });
    const store = makeStore();
    await store.dispatch(fetchDetail('g-1'));
    await store.dispatch(toggleLike('g-1'));
    expect(selectGalleryState(store.getState()).detail.liked).toBe(true);
    expect(selectGalleryState(store.getState()).detail.likeCount).toBe(2);
  });

  it('fetchFollowing.fulfilled stores the handle list', async () => {
    api.following.mockResolvedValue(['ada_maker']);
    const store = makeStore();
    await store.dispatch(fetchFollowing());
    expect(selectFollowing(store.getState())).toEqual(['ada_maker']);
  });

  it('toggleFollow follows when not already following, and adds the handle', async () => {
    api.follow.mockResolvedValue({ handle: 'ada_maker', following: true });
    const store = makeStore();
    await store.dispatch(toggleFollow('ada_maker'));
    expect(api.follow).toHaveBeenCalledWith('ada_maker');
    expect(api.unfollow).not.toHaveBeenCalled();
    expect(selectIsFollowing('ada_maker')(store.getState())).toBe(true);
  });

  it('toggleFollow unfollows when already following, and removes the handle', async () => {
    api.following.mockResolvedValue(['ada_maker']);
    api.unfollow.mockResolvedValue({ handle: 'ada_maker', following: false });
    const store = makeStore();
    await store.dispatch(fetchFollowing());
    await store.dispatch(toggleFollow('ada_maker'));
    expect(api.unfollow).toHaveBeenCalledWith('ada_maker');
    expect(selectFollowing(store.getState())).toEqual([]);
  });

  it('fetchDetail.fulfilled loads the item and its comments together', async () => {
    api.item.mockResolvedValue({ id: 'g-1', name: 'Blink' });
    api.comments.mockResolvedValue([{ id: 'c-1', text: 'nice' }]);
    const store = makeStore();
    await store.dispatch(fetchDetail('g-1'));
    const state = selectGalleryState(store.getState());
    expect(state.detail).toEqual({ id: 'g-1', name: 'Blink' });
    expect(state.comments).toEqual([{ id: 'c-1', text: 'nice' }]);
  });

  it('addComment.fulfilled appends the new comment when it belongs to the open item', async () => {
    api.item.mockResolvedValue({ id: 'g-1' });
    api.comments.mockResolvedValue([]);
    api.addComment.mockResolvedValue({ id: 'c-2', text: 'hello' });
    const store = makeStore();
    await store.dispatch(fetchDetail('g-1'));
    await store.dispatch(addComment({ itemId: 'g-1', text: 'hello' }));
    expect(selectGalleryState(store.getState()).comments).toEqual([{ id: 'c-2', text: 'hello' }]);
  });

  it('addComment.fulfilled is a no-op if the user navigated away from that item', async () => {
    api.item.mockImplementation((id) => Promise.resolve({ id }));
    api.comments.mockImplementation((id) => Promise.resolve(id === 'g-1' ? [{ id: 'c-1' }] : []));
    api.addComment.mockResolvedValue({ id: 'c-2', text: 'late arrival' });
    const store = makeStore();
    await store.dispatch(fetchDetail('g-1'));
    // Simulate having navigated to a different item before the add-comment request resolved.
    await store.dispatch(fetchDetail('g-2'));
    await store.dispatch(addComment({ itemId: 'g-1', text: 'late arrival' }));
    expect(selectGalleryState(store.getState()).detail.id).toBe('g-2');
    expect(selectGalleryState(store.getState()).comments).toEqual([]);
  });

  it('deleteComment.fulfilled removes the comment from the open item', async () => {
    api.item.mockResolvedValue({ id: 'g-1' });
    api.comments.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    api.deleteComment.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(fetchDetail('g-1'));
    await store.dispatch(deleteComment({ itemId: 'g-1', commentId: 'c-1' }));
    expect(selectGalleryState(store.getState()).comments).toEqual([{ id: 'c-2' }]);
  });

  it('remixItem calls the remix endpoint with the item id', async () => {
    api.remix.mockResolvedValue({ id: 'p-new', name: 'Blink (remix)' });
    const store = makeStore();
    const res = await store.dispatch(remixItem({ id: 'g-1', name: 'Blink' }));
    expect(api.remix).toHaveBeenCalledWith('g-1');
    expect(res.payload).toEqual({ id: 'p-new', name: 'Blink (remix)' });
  });
});
