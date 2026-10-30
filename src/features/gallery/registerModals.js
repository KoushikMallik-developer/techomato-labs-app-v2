import { registerModal } from '@/components/Modal';
import AuthorModal from './components/AuthorModal';
import ReportModal from './components/ReportModal';

export function registerGalleryModals() {
  registerModal('author', AuthorModal);
  registerModal('report', ReportModal);
}
