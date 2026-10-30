import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '@/features/auth/authSlice';
import themeReducer from '@/features/theme/themeSlice';
import uiReducer from '@/features/ui/uiSlice';
import projectsReducer from '@/features/projects/projectsSlice';
import galleryReducer from '@/features/gallery/gallerySlice';
import editorReducer from '@/features/editor/editorSlice';
import adminReducer from '@/features/admin/adminSlice';
import notificationsReducer from '@/features/notifications/notificationsSlice';

/** Same shape as the real app/store.js, so any selector works against it. */
export function makeTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      auth: authReducer,
      theme: themeReducer,
      ui: uiReducer,
      projects: projectsReducer,
      gallery: galleryReducer,
      editor: editorReducer,
      admin: adminReducer,
      notifications: notificationsReducer,
    },
    preloadedState,
  });
}

export function signedInUser(overrides = {}) {
  return { id: 'u-1', name: 'Ada Lovelace', email: 'ada@example.com', verified: true, avatar: null, ...overrides };
}

// Redux Toolkit only falls back to a slice's own initialState when the reducer
// receives `undefined`; a partial object in `preloadedState` is used as-is, so
// these helpers always return the *complete* shape to avoid silently-undefined
// fields (e.g. `status`) that a component or selector might read.
export function authState(overrides = {}) {
  return { user: null, initialized: true, status: 'idle', error: null, oauthProviders: {}, ...overrides };
}

export function adminState(overrides = {}) {
  return { isAdmin: false, initialized: true, pending: [], users: [], usersCursor: null, status: 'idle', error: null, ...overrides };
}

export function galleryState(overrides = {}) {
  return {
    items: [],
    status: 'idle',
    q: '',
    tag: '',
    sort: 'popular',
    detail: null,
    comments: [],
    following: [],
    bookmarks: [],
    ...overrides,
  };
}

export function editorState(overrides = {}) {
  return {
    projectId: null,
    name: '',
    parts: [],
    wires: [],
    code: '',
    selection: null,
    pending: null,
    view: '2d',
    running: false,
    sheetCollapsed: false,
    activeTab: 'code',
    status: 'idle',
    saveState: 'saved',
    error: null,
    ...overrides,
  };
}

export function projectsState(overrides = {}) {
  return {
    items: [],
    folders: [],
    status: 'idle',
    query: '',
    sort: 'edited',
    folder: 'all',
    tag: '',
    page: 1,
    ...overrides,
  };
}

/** Renders with a real Redux store (defaults + overrides) and a MemoryRouter. */
// Matches the flags App.jsx passes to BrowserRouter, so tests don't spam
// React Router's "future flag" warnings for behavior we've already opted into.
const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

export function renderWithProviders(ui, { preloadedState, route = '/', store, initialEntries } = {}) {
  const theStore = store || makeTestStore(preloadedState);
  function Wrapper({ children }) {
    return (
      <Provider store={theStore}>
        <MemoryRouter initialEntries={initialEntries || [route]} future={ROUTER_FUTURE}>
          {children}
        </MemoryRouter>
      </Provider>
    );
  }
  return { store: theStore, ...render(ui, { wrapper: Wrapper }) };
}
