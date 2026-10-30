import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectModal, closeModal } from '@/features/ui/uiSlice';

/**
 * Registry of dialog bodies keyed by the `type` string passed to
 * `dispatch(openModal({ type, props }))`. Each feature that needs a modal
 * registers its component here instead of the app importing every feature's
 * modals eagerly — keeps this file a stable, small seam.
 */
const MODAL_COMPONENTS = {};

export function registerModal(type, Component) {
  MODAL_COMPONENTS[type] = Component;
}

export default function Modal() {
  const { type, props } = useSelector(selectModal);
  const dispatch = useDispatch();
  const modalRef = useRef(null);

  useEffect(() => {
    if (!type) return;
    const onKey = (e) => {
      if (e.key === 'Escape') dispatch(closeModal());
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      modalRef.current?.querySelector('input, textarea, button')?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [type, dispatch]);

  if (!type) return null;
  const Body = MODAL_COMPONENTS[type];
  if (!Body) return null;

  return (
    <div
      className="modal-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dispatch(closeModal());
      }}
    >
      <div className="modal glass" role="dialog" aria-modal="true" ref={modalRef}>
        <Body {...props} close={() => dispatch(closeModal())} />
      </div>
    </div>
  );
}
