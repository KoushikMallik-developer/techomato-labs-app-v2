import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import themeReducer from '@/features/theme/themeSlice';
import uiReducer from '@/features/ui/uiSlice';
import projectsReducer from '@/features/projects/projectsSlice';
import galleryReducer from '@/features/gallery/gallerySlice';
import editorReducer from '@/features/editor/editorSlice';
import adminReducer from '@/features/admin/adminSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    ui: uiReducer,
    projects: projectsReducer,
    gallery: galleryReducer,
    editor: editorReducer,
    admin: adminReducer,
  },
});
