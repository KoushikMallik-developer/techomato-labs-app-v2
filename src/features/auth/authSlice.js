import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

/** Runs once on app start to find out whether the session cookie (if any) is
 * still good, before any route guard makes a redirect decision. */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => api.me());

export const signup = createAsyncThunk('auth/signup', async (form) => api.signup(form));
export const login = createAsyncThunk('auth/login', async (form) => api.login(form));
export const logout = createAsyncThunk('auth/logout', async () => {
  await api.logout();
});

/** Firebase popup sign-in — see api.oauthLogin(). */
export const fetchOAuthProviders = createAsyncThunk('auth/fetchOAuthProviders', async () => api.oauthProviders());
export const oauthLogin = createAsyncThunk('auth/oauthLogin', async ({ provider }) => api.oauthLogin(provider));

export const updateProfile = createAsyncThunk('auth/updateProfile', async (patch) => api.updateMe(patch));
export const changePassword = createAsyncThunk('auth/changePassword', async (form) => {
  await api.changePassword(form);
});
export const deleteAccount = createAsyncThunk('auth/deleteAccount', async () => {
  await api.deleteAccount();
});

export const resendVerification = createAsyncThunk('auth/resendVerification', async () => api.resendVerification());
export const verifyEmail = createAsyncThunk('auth/verifyEmail', async (token) => api.verifyEmail(token));

export const requestPasswordReset = createAsyncThunk('auth/requestPasswordReset', async (email) =>
  api.requestPasswordReset(email),
);
export const resetPassword = createAsyncThunk('auth/resetPassword', async (form) => api.resetPassword(form));

const initialState = {
  user: null,
  initialized: false,
  status: 'idle', // idle | loading | failed
  error: null,
  oauthProviders: {},
};

function pending(state) {
  state.status = 'loading';
  state.error = null;
}
function rejected(state, action) {
  state.status = 'failed';
  state.error = action.error.message || 'Something went wrong.';
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.initialized = true;
        state.user = action.payload;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.initialized = true;
        state.user = null;
      })
      .addCase(signup.pending, pending)
      .addCase(signup.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload;
      })
      .addCase(signup.rejected, rejected)
      .addCase(login.pending, pending)
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload;
      })
      .addCase(login.rejected, rejected)
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = 'idle';
        state.error = null;
      })
      .addCase(fetchOAuthProviders.fulfilled, (state, action) => {
        state.oauthProviders = action.payload || {};
      })
      .addCase(oauthLogin.pending, pending)
      .addCase(oauthLogin.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload;
      })
      .addCase(oauthLogin.rejected, rejected)
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.user = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        if (state.user && state.user.id === action.payload.id) state.user = action.payload;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (state) => state.auth.user;
export const selectIsSignedIn = (state) => !!state.auth.user;
export const selectAuthInitialized = (state) => state.auth.initialized;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectOAuthProviders = (state) => state.auth.oauthProviders;
