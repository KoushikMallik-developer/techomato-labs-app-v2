import { registerModal } from './Modal';
import ConfirmModal from './ConfirmModal';

/** Modals shared across features. Feature-specific modals register themselves in their own module. */
export function registerCoreModals() {
  registerModal('confirm', ConfirmModal);
}
