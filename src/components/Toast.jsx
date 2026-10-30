import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectToast, clearToast } from '@/features/ui/uiSlice';

export default function Toast() {
  const toast = useSelector(selectToast);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!toast.id) return;
    const t = setTimeout(() => dispatch(clearToast()), 2600);
    return () => clearTimeout(t);
  }, [toast.id, dispatch]);

  if (!toast.id) return null;
  return (
    <div className="toast glass" role="status">
      {toast.message}
    </div>
  );
}
