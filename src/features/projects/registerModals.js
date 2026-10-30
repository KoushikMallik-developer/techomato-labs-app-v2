import { registerModal } from '@/components/Modal';
import NewProjectModal from './components/NewProjectModal';
import ManageFoldersModal from './components/ManageFoldersModal';
import RenameModal from './components/RenameModal';
import TagsModal from './components/TagsModal';
import FolderPickerModal from './components/FolderPickerModal';
import PublishModal from './components/PublishModal';
import ProjectMenuModal from './components/ProjectMenuModal';

export function registerProjectsModals() {
  registerModal('new-project', NewProjectModal);
  registerModal('manage-folders', ManageFoldersModal);
  registerModal('rename-project', RenameModal);
  registerModal('edit-tags', TagsModal);
  registerModal('folder-picker', FolderPickerModal);
  registerModal('publish', PublishModal);
  registerModal('project-menu', ProjectMenuModal);
}
