import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

export const fetchProjects = createAsyncThunk('projects/fetch', async () => {
  const [items, folders] = await Promise.all([api.projects(), api.folders()]);
  return { items, folders };
});
export const createProject = createAsyncThunk('projects/create', async ({ templateKey, name }) =>
  api.create(templateKey, name),
);
export const saveProject = createAsyncThunk('projects/save', async ({ id, patch }) => api.save(id, patch));
export const removeProject = createAsyncThunk('projects/remove', async (id) => {
  await api.remove(id);
  return id;
});
export const duplicateProject = createAsyncThunk('projects/duplicate', async (id) => api.duplicate(id));
export const publishProject = createAsyncThunk('projects/publish', async ({ id, meta }) =>
  api.publish(id, meta),
);
export const unpublishProject = createAsyncThunk('projects/unpublish', async (id) => api.unpublish(id));
export const importProject = createAsyncThunk('projects/import', async (json) => api.importProject(JSON.parse(json)));

export const createFolder = createAsyncThunk('projects/createFolder', async (name) => api.createFolder(name));
export const renameFolder = createAsyncThunk('projects/renameFolder', async ({ id, name }) => {
  const folder = await api.renameFolder(id, name);
  return { id, name: folder.name };
});
export const deleteFolder = createAsyncThunk('projects/deleteFolder', async (id) => {
  await api.deleteFolder(id);
  return id;
});
export const moveToFolder = createAsyncThunk('projects/moveToFolder', async ({ id, folderId }) =>
  api.moveToFolder(id, folderId),
);

const initialState = {
  items: [],
  folders: [],
  status: 'idle',
  query: '',
  sort: 'edited', // edited | name | created
  folder: 'all', // 'all' | 'none' | folder id
  tag: '',
  page: 1,
};

function upsert(state, project) {
  if (!project) return;
  const idx = state.items.findIndex((p) => p.id === project.id);
  if (idx >= 0) state.items[idx] = project;
  else state.items.push(project);
}

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setQuery(state, action) {
      state.query = action.payload;
      state.page = 1;
    },
    setSort(state, action) {
      state.sort = action.payload;
    },
    setFolderFilter(state, action) {
      state.folder = action.payload;
      state.page = 1;
    },
    setTagFilter(state, action) {
      state.tag = action.payload;
      state.page = 1;
    },
    nextPage(state) {
      state.page += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload.items;
        state.folders = action.payload.folders;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(saveProject.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(removeProject.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.id !== action.payload);
      })
      .addCase(duplicateProject.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(publishProject.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(unpublishProject.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(importProject.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(createFolder.fulfilled, (state, action) => {
        state.folders.push(action.payload);
      })
      .addCase(renameFolder.fulfilled, (state, action) => {
        const f = state.folders.find((x) => x.id === action.payload.id);
        if (f) f.name = action.payload.name;
      })
      .addCase(deleteFolder.fulfilled, (state, action) => {
        state.folders = state.folders.filter((f) => f.id !== action.payload);
        state.items.forEach((p) => {
          if (p.folder === action.payload) p.folder = null;
        });
      })
      .addCase(moveToFolder.fulfilled, (state, action) => {
        upsert(state, action.payload);
      });
  },
});

export const { setQuery, setSort, setFolderFilter, setTagFilter, nextPage } = projectsSlice.actions;
export default projectsSlice.reducer;

export const selectProjectsState = (state) => state.projects;
