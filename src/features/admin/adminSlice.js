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

export const approveCircuit = createAsyncThunk('admin/approve', async (id, { dispatch }) => {
  await api.approveCircuit(id);
  await dispatch(fetchPending());
  return id;
});

export const rejectCircuit = createAsyncThunk('admin/reject', async (id, { dispatch }) => {
  await api.rejectCircuit(id);
  await dispatch(fetchPending());
  return id;
});

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    isAdmin: false,
    initialized: false,
    pending: [],
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
