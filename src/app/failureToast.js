import { isRejected } from '@reduxjs/toolkit';
import { showToast } from '@/features/ui/uiSlice';

/**
 * Shows a toast when a dashboard, gallery or admin-panel action fails, so a write the rules refuse (circuit limit, unverified
 * email, a circuit changed since review, ...) never fails silently. Auth, admin login and editor actions show their own errors.
 */
export const failureToast = (store) => (next) => (action) => {
  if (isRejected(action) && !action.meta?.condition && /^(projects|gallery)\/|^admin\/(approve|reject|fetchUsers|setUserDisabled)/.test(action.type) && action.error?.message) {
    store.dispatch(showToast(action.error.message));
  }
  return next(action);
};
