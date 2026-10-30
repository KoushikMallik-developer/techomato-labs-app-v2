import { registerCoreModals } from '@/components/registerCoreModals';
import { registerProjectsModals } from '@/features/projects/registerModals';
import { registerGalleryModals } from '@/features/gallery/registerModals';

/** Called once at startup so every feature's modal dialogs are known to <Modal/>. */
export function registerAllModals() {
  registerCoreModals();
  registerProjectsModals();
  registerGalleryModals();
}
