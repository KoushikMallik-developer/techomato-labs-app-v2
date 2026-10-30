import { describe, it, expect, vi } from 'vitest';
import { registerModal } from '@/components/Modal';
import { registerGalleryModals } from './registerModals';
import AuthorModal from './components/AuthorModal';
import ReportModal from './components/ReportModal';

vi.mock('@/components/Modal', () => ({ registerModal: vi.fn() }));

describe('registerGalleryModals', () => {
  it('registers AuthorModal under "author" and ReportModal under "report"', () => {
    registerGalleryModals();
    expect(registerModal).toHaveBeenCalledWith('author', AuthorModal);
    expect(registerModal).toHaveBeenCalledWith('report', ReportModal);
    expect(registerModal).toHaveBeenCalledTimes(2);
  });
});
