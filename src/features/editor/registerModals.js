import { registerModal } from '@/components/Modal';
import ShortcutsModal from './components/ShortcutsModal';

export function registerEditorModals() {
  registerModal('shortcuts', ShortcutsModal);
}
