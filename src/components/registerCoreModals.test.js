import { describe, it, expect, vi } from 'vitest';
import { registerModal } from './Modal';
import { registerCoreModals } from './registerCoreModals';
import ConfirmModal from './ConfirmModal';

vi.mock('./Modal', () => ({ registerModal: vi.fn() }));

describe('registerCoreModals', () => {
  it('registers ConfirmModal under "confirm"', () => {
    registerCoreModals();
    expect(registerModal).toHaveBeenCalledWith('confirm', ConfirmModal);
  });
});
