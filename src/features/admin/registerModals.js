import { registerModal } from '@/components/Modal';
import UserCircuitsModal from './components/UserCircuitsModal';

export function registerAdminModals() {
  registerModal('user-circuits', UserCircuitsModal);
}
