import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './router';
import Modal from '@/components/Modal';
import Toast from '@/components/Toast';
import { bootstrapAuth, selectAuthInitialized } from '@/features/auth/authSlice';
import { bootstrapAdmin, selectAdminInitialized } from '@/features/admin/adminSlice';

// Opt into React Router v7's upcoming defaults now to silence the future-flag
// warnings and make an eventual v6 -> v7 upgrade a no-op for routing behavior.
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

export default function App() {
  const dispatch = useDispatch();
  const authReady = useSelector(selectAuthInitialized);
  const adminReady = useSelector(selectAdminInitialized);

  useEffect(() => {
    dispatch(bootstrapAuth());
    dispatch(bootstrapAdmin());
  }, [dispatch]);

  // Wait to know whether the session cookie (if any) is still good before any
  // route guard makes a redirect decision — otherwise a signed-in visitor
  // reloading /projects would flash through /login first.
  if (!authReady || !adminReady) return null;

  return (
    <BrowserRouter future={future}>
      <AppRouter />
      <Modal />
      <Toast />
    </BrowserRouter>
  );
}
