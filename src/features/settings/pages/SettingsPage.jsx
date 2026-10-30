import AppShell from '@/components/AppShell';
import ProfilePanel from '../components/ProfilePanel';
import AppearancePanel from '../components/AppearancePanel';
import PasswordPanel from '../components/PasswordPanel';
import FollowingPanel from '../components/FollowingPanel';
import DangerZonePanel from '../components/DangerZonePanel';

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="narrow">
        <p className="muted">Your profile, appearance, and account.</p>
        <ProfilePanel />
        <AppearancePanel />
        <PasswordPanel />
        <FollowingPanel />
        <DangerZonePanel />
      </div>
    </AppShell>
  );
}
