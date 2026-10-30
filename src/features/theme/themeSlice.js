import { createSlice } from '@reduxjs/toolkit';
import { storage } from '@/lib/storage';

const THEME_KEY = 'vl.theme';

function applyThemeAttribute(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') root.setAttribute('data-theme', 'dark');
  else if (mode === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}

const initialMode = storage.get(THEME_KEY, 'system');
applyThemeAttribute(initialMode);

const themeSlice = createSlice({
  name: 'theme',
  initialState: { mode: initialMode },
  reducers: {
    setTheme(state, action) {
      state.mode = action.payload;
      storage.set(THEME_KEY, action.payload);
      applyThemeAttribute(action.payload);
    },
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;

export const selectThemeMode = (state) => state.theme.mode;
