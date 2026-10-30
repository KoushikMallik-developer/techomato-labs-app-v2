import { describe, it, expect, vi } from 'vitest';
import { registerModal } from '@/components/Modal';
import { registerProjectsModals } from './registerModals';
import NewProjectModal from './components/NewProjectModal';
import ManageFoldersModal from './components/ManageFoldersModal';
import RenameModal from './components/RenameModal';
import TagsModal from './components/TagsModal';
import FolderPickerModal from './components/FolderPickerModal';
import PublishModal from './components/PublishModal';
import ProjectMenuModal from './components/ProjectMenuModal';

vi.mock('@/components/Modal', () => ({ registerModal: vi.fn() }));

describe('registerProjectsModals', () => {
  it('registers every projects modal under its expected type key', () => {
    registerProjectsModals();
    expect(registerModal).toHaveBeenCalledWith('new-project', NewProjectModal);
    expect(registerModal).toHaveBeenCalledWith('manage-folders', ManageFoldersModal);
    expect(registerModal).toHaveBeenCalledWith('rename-project', RenameModal);
    expect(registerModal).toHaveBeenCalledWith('edit-tags', TagsModal);
    expect(registerModal).toHaveBeenCalledWith('folder-picker', FolderPickerModal);
    expect(registerModal).toHaveBeenCalledWith('publish', PublishModal);
    expect(registerModal).toHaveBeenCalledWith('project-menu', ProjectMenuModal);
    expect(registerModal).toHaveBeenCalledTimes(7);
  });
});
