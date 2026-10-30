import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import RequireAuth from '@/features/auth/RequireAuth';
import RequireGuest from '@/features/auth/RequireGuest';
import RequireAdmin from '@/features/admin/RequireAdmin';

import LandingPage from '@/features/landing/pages/LandingPage';
import LoginPage from '@/features/auth/pages/LoginPage';
import SignupPage from '@/features/auth/pages/SignupPage';
import ForgotPage from '@/features/auth/pages/ForgotPage';
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage';
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage';
import ProjectsPage from '@/features/projects/pages/ProjectsPage';
import GalleryPage from '@/features/gallery/pages/GalleryPage';
import DetailPage from '@/features/gallery/pages/DetailPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import EditorPage from '@/features/editor/pages/EditorPage';
import AdminLoginPage from '@/features/admin/pages/AdminLoginPage';
import AdminPanelPage from '@/features/admin/pages/AdminPanelPage';
import NotFoundPage from '@/components/NotFoundPage';

/** /gallery/:id used to be the Community Circuits detail route. */
function RedirectToCommunityItem() {
  const { id } = useParams();
  return <Navigate to={`/community/${id}`} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route
        path="/signup"
        element={
          <RequireGuest>
            <SignupPage />
          </RequireGuest>
        }
      />
      <Route path="/forgot" element={<ForgotPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <ProjectsPage />
          </RequireAuth>
        }
      />
      <Route path="/community" element={<GalleryPage />} />
      <Route path="/community/:id" element={<DetailPage />} />
      {/* old links keep working */}
      <Route path="/gallery" element={<Navigate to="/community" replace />} />
      <Route path="/gallery/:id" element={<RedirectToCommunityItem />} />
      <Route
        path="/editor/:id"
        element={
          <RequireAuth>
            <EditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPanelPage />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
