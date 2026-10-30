import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

/** Entirely separate from the regular user session in authSlice — an admin
 * is not a "user" record and there is no signup flow for this role. */
export const bootstrapAdmin = createAsyncThunk('admin/bootstrap', async () => api.adminSession());

export const adminLogin = createAsyncThunk('admin/login', async (form) => api.adminLogin(form));
export const adminLogout = createAsyncThunk('admin/logout', async () => {
  await api.adminLogout();
});

export const fetchPending = createAsyncThunk('admin/fetchPending', async () => api.pendingCircuits());

export const approveCircuit = createAsyncThunk('admin/approve', async ({ id, seen }, { dispatch }) => {
  try {
    await api.approveCircuit(id, seen);
  } finally {
    await dispatch(fetchPending()); // also after a "changed since you opened it" refusal, so the new version shows
  }
  return id;
});

export const rejectCircuit = createAsyncThunk('admin/reject', async (id, { dispatch }) => {
  await api.rejectCircuit(id);
  await dispatch(fetchPending());
  return id;
});

/** `fetchUsers({ q })` loads the first page (or a search); `fetchUsers({ more: true })` appends the next page. */
export const fetchUsers = createAsyncThunk('admin/fetchUsers', async ({ q = '', more } = {}, { getState }) =>
  api.adminUsers({ q, after: more ? getState().admin.usersCursor : undefined }),
);

export const setUserDisabled = createAsyncThunk('admin/setUserDisabled', async ({ id, disabled }) =>
  api.setUserDisabled(id, disabled),
);

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    isAdmin: false,
    initialized: false,
    pending: [],
    users: [],
    usersCursor: null, // createdAt of the last loaded user; null = no more pages
    status: 'idle', // idle | loading | failed
    error: null,
  },
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
      .addCase(adminLogout.fulfilled, (state) => {
        state.isAdmin = false;
      })
      .addCase(fetchPending.fulfilled, (state, action) => {
        state.pending = action.payload;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        const { users, cursor } = action.payload;
        state.users = action.meta.arg?.more ? [...state.users, ...users] : users;
        state.usersCursor = cursor;
      })
      .addCase(setUserDisabled.fulfilled, (state, action) => {
        const user = state.users.find((u) => u.id === action.payload.id);
        if (user) user.disabled = action.payload.disabled;
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
export const selectAdminUsers = (state) => state.admin.users;
export const selectUsersCursor = (state) => state.admin.usersCursor;
