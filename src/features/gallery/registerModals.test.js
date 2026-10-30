import { describe, it, expect, vi } from 'vitest';
import { registerModal } from '@/components/Modal';
import { registerGalleryModals } from './registerModals';
import AuthorModal from './components/AuthorModal';

vi.mock('@/components/Modal', () => ({ registerModal: vi.fn() }));

describe('registerGalleryModals', () => {
  it('registers AuthorModal under "author"', () => {
    registerGalleryModals();
    expect(registerModal).toHaveBeenCalledWith('author', AuthorModal);
    expect(registerModal).toHaveBeenCalledTimes(1);
  });
});
