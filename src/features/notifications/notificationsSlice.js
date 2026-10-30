import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import { logout, deleteAccount } from '@/features/auth/authSlice';

/** Loaded once per session (and again on the Notifications page), so the badge does not cost a read per page. */
/** `fetchNotifications(10)` is enough for the menu badge; the page asks for the default 30. */
export const fetchNotifications = createAsyncThunk('notifications/fetch', async (count) => api.notifications(count), {
  // The shell and the Notifications page both ask on first load; one request is enough.
  condition: (_, { getState }) => getState().notifications.status !== 'loading',
});

export const markAllRead = createAsyncThunk('notifications/markAllRead', async (_, { getState }) => {
  const unread = getState().notifications.items.filter((n) => !n.read).map((n) => n.id);
  return unread.length ? api.markNotificationsRead(unread) : [];
});

const initialState = { items: [], status: 'idle' };

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'ready';
        state.items = action.payload;
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.status = 'ready';
      })
      .addCase(markAllRead.fulfilled, (state, action) => {
        const done = new Set(action.payload);
        state.items.forEach((n) => {
          if (done.has(n.id)) n.read = true;
        });
      })
      .addMatcher(isAnyOf(logout.fulfilled, deleteAccount.fulfilled), () => initialState);
  },
});

export default notificationsSlice.reducer;

export const selectNotifications = (state) => state.notifications;
export const selectUnreadCount = (state) => state.notifications.items.filter((n) => !n.read).length;
