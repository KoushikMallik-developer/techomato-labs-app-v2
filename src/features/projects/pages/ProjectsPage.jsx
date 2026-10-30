import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AppShell from '@/components/AppShell';
import ProjectGrid from '../components/ProjectGrid';
import {
  fetchProjects,
  setQuery,
  setSort,
  setFolderFilter,
  setTagFilter,
  nextPage,
  importProject,
  selectProjectsState,
} from '../projectsSlice';
import { openModal, showToast } from '@/features/ui/uiSlice';

const PAGE_SIZE = 9;

export default function ProjectsPage() {
  const dispatch = useDispatch();
  const { items, folders, query, sort, folder, tag, page, status } = useSelector(selectProjectsState);
  const fileInputRef = useRef(null);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const allTags = useMemo(() => [...new Set(items.flatMap((p) => p.tags || []))].sort(), [items]);

  const filtered = useMemo(() => {
    let list = items;
    const needle = query.trim().toLowerCase();
    if (needle) list = list.filter((p) => p.name.toLowerCase().includes(needle));
    if (folder === 'none') list = list.filter((p) => !p.folder);
    else if (folder !== 'all') list = list.filter((p) => p.folder === folder);
    if (tag) list = list.filter((p) => (p.tags || []).includes(tag));
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'created') return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [items, query, folder, tag, sort]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  function onMenu(project) {
    dispatch(openModal({ type: 'project-menu', props: { project } }));
  }

  function onNew() {
    dispatch(openModal({ type: 'new-project', props: {} }));
  }

  function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await dispatch(importProject(reader.result)).unwrap();
        dispatch(showToast('Project imported.'));
      } catch {
        dispatch(showToast('That file could not be imported.'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <AppShell title="Your projects">
      <div className="head">
        <div>
          <p>Everything you&apos;ve built, saved to your account.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={onImportFile}
            />
            <button className="btn primary" onClick={onNew}>
              New project
            </button>
          </div>
        </div>

        <div className="toolbar">
          <input
            className="input"
            placeholder="Search projects…"
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
          />
          <select className="input" value={sort} onChange={(e) => dispatch(setSort(e.target.value))}>
            <option value="edited">Recently edited</option>
            <option value="name">Name</option>
            <option value="created">Recently created</option>
          </select>
        </div>

        <div className="fchips" style={{ marginBottom: 14 }}>
          <button className={`fchip${folder === 'all' ? ' on' : ''}`} onClick={() => dispatch(setFolderFilter('all'))}>
            All
          </button>
          <button className={`fchip${folder === 'none' ? ' on' : ''}`} onClick={() => dispatch(setFolderFilter('none'))}>
            No folder
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              className={`fchip${folder === f.id ? ' on' : ''}`}
              onClick={() => dispatch(setFolderFilter(f.id))}
            >
              {f.name}
            </button>
          ))}
          <button className="fchip" onClick={() => dispatch(openModal({ type: 'manage-folders', props: {} }))}>
            Manage folders&hellip;
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="fchips" style={{ marginBottom: 20 }}>
            <button className={`fchip${!tag ? ' on' : ''}`} onClick={() => dispatch(setTagFilter(''))}>
              All tags
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                className={`fchip${tag === t ? ' on' : ''}`}
                onClick={() => dispatch(setTagFilter(t))}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {status === 'loading' && items.length === 0 ? (
          <p className="muted">Loading&hellip;</p>
        ) : (
          <>
            <ProjectGrid items={visible} folderById={folderById} onMenu={onMenu} onNew={onNew} />
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn" onClick={() => dispatch(nextPage())}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
    </AppShell>
  );
}
