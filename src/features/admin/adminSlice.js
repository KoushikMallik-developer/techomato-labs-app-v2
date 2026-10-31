import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import { REPORTS_SHOWN } from '@/lib/limits';
import { showToast } from '@/features/ui/uiSlice';

/** Entirely separate from the regular user session in authSlice — an admin
 * is not a "user" record and there is no signup flow for this role. */
export const bootstrapAdmin = createAsyncThunk('admin/bootstrap', async () => api.adminSession());

export const adminLogin = createAsyncThunk('admin/login', async (form) => api.adminLogin(form));
export const adminLogout = createAsyncThunk('admin/logout', async () => {
  await api.adminLogout();
});

export const fetchPending = createAsyncThunk('admin/fetchPending', async () =>
  api.pendingCircuits(),
);

export const approveCircuit = createAsyncThunk(
  'admin/approve',
  async ({ id, seen }, { dispatch }) => {
    try {
      await api.approveCircuit(id, seen);
    } finally {
      await dispatch(fetchPending()); // also after a "changed since you opened it" refusal, so the new version shows
    }
    return id;
  },
);

export const rejectCircuit = createAsyncThunk('admin/reject', async (id, { dispatch }) => {
  await api.rejectCircuit(id);
  await dispatch(fetchPending());
  return id;
});

/** `fetchUsers({ q })` loads the first page (or a search); `fetchUsers({ more: true })` appends the next page. */
export const fetchUsers = createAsyncThunk(
  'admin/fetchUsers',
  async ({ q = '', more } = {}, { getState }) =>
    api.adminUsers({ q, after: more ? getState().admin.usersCursor : undefined }),
);

export const setUserDisabled = createAsyncThunk('admin/setUserDisabled', async ({ id, disabled }) =>
  api.setUserDisabled(id, disabled),
);

export const fetchReports = createAsyncThunk('admin/fetchReports', async () => api.adminReports());
/** `ids` is a list, so closing every report about one item reloads the list once, not once per report. */
export const dismissReport = createAsyncThunk('admin/dismissReport', async (ids, { dispatch, getState }) => {
  // Settled, not all-or-nothing: the ones that were deleted must leave the list even if another delete failed.
  const results = await Promise.allSettled(ids.map((id) => api.dismissReport(id)));
  const done = ids.filter((_, i) => results[i].status === 'fulfilled');
  if (done.length < ids.length) dispatch(showToast('Some reports could not be closed. Try again.'));
  // At the cap, older reports are waiting unseen: load them into the freed slots.
  if (done.length && getState().admin.reports.length >= REPORTS_SHOWN) await dispatch(fetchReports());
  return done;
});

const initialState = {
  isAdmin: false,
  initialized: false,
  pending: [],
  reports: [],
  // which lists have answered at least once, so an empty list is not shown while still loading
  loaded: { pending: false, reports: false, users: false },
  users: [],
  usersCursor: null, // createdAt of the last loaded user; null = no more pages
  status: 'idle', // idle | loading | failed
  error: null,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAdmin.fulfilled, (state, action) => {
        state.initialized = true;
        state.isAdmin = !!action.payload?.isAdmin;
      })
      .addCase(bootstrapAdmin.rejected, (state) => {
        state.initialized = true;
        state.isAdmin = false;
      })
      .addCase(adminLogin.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(adminLogin.fulfilled, (state) => {
        state.status = 'idle';
        state.isAdmin = true;
      })
      .addCase(adminLogin.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Something went wrong.';
      })
      .addCase(adminLogout.fulfilled, () => ({ ...initialState, initialized: true }))
      .addCase(fetchPending.fulfilled, (state, action) => {
        state.pending = action.payload;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        const { users, cursor } = action.payload;
        state.users = action.meta.arg?.more ? [...state.users, ...users] : users;
        state.usersCursor = cursor;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports = action.payload;
      })
      .addCase(dismissReport.fulfilled, (state, action) => {
        state.reports = state.reports.filter((r) => !action.payload.includes(r.id));
      })
      .addCase(setUserDisabled.fulfilled, (state, action) => {
        const user = state.users.find((u) => u.id === action.payload.id);
        if (user) user.disabled = action.payload.disabled;
      })
      .addMatcher(isAnyOf(fetchPending.fulfilled, fetchPending.rejected), (state) => {
        state.loaded.pending = true;
      })
      .addMatcher(isAnyOf(fetchReports.fulfilled, fetchReports.rejected), (state) => {
        state.loaded.reports = true;
      })
      .addMatcher(isAnyOf(fetchUsers.fulfilled, fetchUsers.rejected), (state) => {
        state.loaded.users = true;
      });
  },
});

export const { clearAdminError } = adminSlice.actions;
export default adminSlice.reducer;

export const selectIsAdmin = (state) => state.admin.isAdmin;
export const selectAdminInitialized = (state) => state.admin.initialized;
export const selectAdminStatus = (state) => state.admin.status;
export const selectAdminError = (state) => state.admin.error;
export const selectPendingCircuits = (state) => state.admin.pending;
export const selectAdminReports = (state) => state.admin.reports;
export const selectAdminLoaded = (state) => state.admin.loaded;
export const selectAdminUsers = (state) => state.admin.users;
export const selectUsersCursor = (state) => state.admin.usersCursor;
