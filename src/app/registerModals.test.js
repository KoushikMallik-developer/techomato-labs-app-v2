import { describe, it, expect, vi } from 'vitest';
import { registerAllModals } from './registerModals';
import { registerCoreModals } from '@/components/registerCoreModals';
import { registerProjectsModals } from '@/features/projects/registerModals';
import { registerGalleryModals } from '@/features/gallery/registerModals';

vi.mock('@/components/registerCoreModals', () => ({ registerCoreModals: vi.fn() }));
vi.mock('@/features/projects/registerModals', () => ({ registerProjectsModals: vi.fn() }));
vi.mock('@/features/gallery/registerModals', () => ({ registerGalleryModals: vi.fn() }));
vi.mock('@/features/editor/registerModals', () => ({ registerEditorModals: vi.fn() }));

describe('registerAllModals', () => {
  it('registers every feature\'s modals', () => {
    registerAllModals();
    expect(registerCoreModals).toHaveBeenCalledTimes(1);
    expect(registerProjectsModals).toHaveBeenCalledTimes(1);
    expect(registerGalleryModals).toHaveBeenCalledTimes(1);
  });
});
