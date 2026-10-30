import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

export const fetchGallery = createAsyncThunk('gallery/fetch', async (_, { getState }) => {
  const { q, tag, sort } = getState().gallery;
  return api.gallery({ q, tag, sort });
});

/** The backend's like endpoint is idempotent PUT (like) / DELETE (unlike) and
 * hands back the new {liked, likeCount} directly, so there's no need to
 * refetch the whole gallery — just patch the one item everywhere it appears. */
export const toggleLike = createAsyncThunk('gallery/toggleLike', async (id, { getState }) => {
  const { items, detail } = getState().gallery;
  const current = detail?.id === id ? detail : items.find((i) => i.id === id);
  const liked = current ? !current.liked : true;
  const result = liked ? await api.like(id) : await api.unlike(id);
  return { id, ...result };
});

export const fetchFollowing = createAsyncThunk('gallery/fetchFollowing', async () => api.following());

export const toggleFollow = createAsyncThunk('gallery/toggleFollow', async (handle, { getState }) => {
  const following = getState().gallery.following.includes(handle);
  if (following) await api.unfollow(handle);
  else await api.follow(handle);
  return { handle, following: !following };
});

export const fetchDetail = createAsyncThunk('gallery/fetchDetail', async (id) => {
  const [item, comments] = await Promise.all([api.item(id), api.comments(id)]);
  return { item, comments };
});
export const addComment = createAsyncThunk('gallery/addComment', async ({ itemId, text }) => {
  const comment = await api.addComment(itemId, text);
  return { itemId, comment };
});
export const deleteComment = createAsyncThunk('gallery/deleteComment', async ({ itemId, commentId }) => {
  await api.deleteComment(itemId, commentId);
  return { itemId, commentId };
});
/** "Open a copy" — copies the community circuit into the signed-in user's
 * own projects, for both real projects and seed items. */
export const remixItem = createAsyncThunk('gallery/remix', async (item) => api.remix(item.id));

function patchItem(state, id, patch) {
  const i = state.items.find((x) => x.id === id);
  if (i) Object.assign(i, patch);
  if (state.detail?.id === id) Object.assign(state.detail, patch);
}

const gallerySlice = createSlice({
  name: 'gallery',
  initialState: {
    items: [],
    status: 'idle',
    q: '',
    tag: '',
    sort: 'popular', // popular | new
    detail: null,
    comments: [],
    following: [],
  },
  reducers: {
    setQuery(state, action) {
      state.q = action.payload;
    },
    setTag(state, action) {
      state.tag = action.payload;
    },
    setSort(state, action) {
      state.sort = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGallery.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchGallery.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload;
      })
      .addCase(toggleLike.fulfilled, (state, action) => {
        const { id, liked, likeCount } = action.payload;
        patchItem(state, id, { liked, likeCount });
      })
      .addCase(fetchFollowing.fulfilled, (state, action) => {
        state.following = action.payload;
      })
      .addCase(toggleFollow.fulfilled, (state, action) => {
        const { handle, following } = action.payload;
        state.following = following
          ? [...new Set([...state.following, handle])]
          : state.following.filter((h) => h !== handle);
      })
      .addCase(fetchDetail.fulfilled, (state, action) => {
        state.detail = action.payload.item;
        state.comments = action.payload.comments;
      })
      .addCase(addComment.fulfilled, (state, action) => {
        if (state.detail?.id === action.payload.itemId) state.comments.push(action.payload.comment);
      })
      .addCase(deleteComment.fulfilled, (state, action) => {
        if (state.detail?.id === action.payload.itemId) {
          state.comments = state.comments.filter((c) => c.id !== action.payload.commentId);
        }
      });
  },
});

export const { setQuery, setTag, setSort } = gallerySlice.actions;
export default gallerySlice.reducer;

export const selectGalleryState = (state) => state.gallery;
export const selectFollowing = (state) => state.gallery.following;
export const selectIsFollowing = (handle) => (state) => state.gallery.following.includes(handle);
