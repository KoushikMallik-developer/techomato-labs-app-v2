import { registerModal } from '@/components/Modal';
import AuthorModal from './components/AuthorModal';

export function registerGalleryModals() {
  registerModal('author', AuthorModal);
}
