import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import BrandMark from '@/components/BrandMark';
import { REPORTS_SHOWN } from '@/lib/limits';
import PendingSection from '../components/PendingSection';
import ReportsSection from '../components/ReportsSection';
import ActivitySection from '../components/ActivitySection';
import UsersSection from '../components/UsersSection';
import { timeAgo } from '../timeAgo';
import {
  fetchPending,
  fetchReports,
  adminLogout,
  selectPendingCircuits,
  selectAdminReports,
  selectAdminLoaded,
} from '../adminSlice';

const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'Overview',
    sub: 'What needs your attention right now.',
  },
  {
    id: 'review',
    label: 'Review queue',
    title: 'Review queue',
    sub: 'Circuits submitted to Community Circuits, waiting for a decision.',
  },
  {
    id: 'reports',
    label: 'Reports',
    title: 'Reports',
    sub: 'Circuits and discussions users flagged, grouped by target.',
  },
  {
    id: 'users',
    label: 'Users',
    title: 'Users',
    sub: 'Newest first. A disabled account can browse but cannot write anything.',
  },
];

function Overview({ pending, reports, loaded, go }) {
  const oldest = pending.at(-1); // the queue is newest first
  const latest = reports[0];
  const num = (n, ready) => (ready ? n : '–');
  return (
    <>
      <div className="adm-stats">
        <button className="adm-stat glass" onClick={() => go('review')}>
          <b>{num(pending.length, loaded.pending)}</b>
          <span>awaiting review</span>
        </button>
        <button className="adm-stat glass" onClick={() => go('reports')}>
          <b>{num(reports.length, loaded.reports)}</b>
          <span>open reports</span>
        </button>
      </div>
      <div className="adm-list">
        <div className="adm-row glass">
          <b>Oldest submission</b>
          <span className="muted small">
            {oldest
              ? `${oldest.name} by @${oldest.author}, ${timeAgo(oldest.publishedAt || oldest.updatedAt)}`
              : loaded.pending
                ? 'Nothing waiting.'
                : '–'}
          </span>
        </div>
        <div className="adm-row glass">
          <b>Latest report</b>
          <span className="muted small">
            {latest
              ? `${latest.reason} (${timeAgo(latest.createdAt)})`
              : loaded.reports
                ? 'No open reports.'
                : '–'}
          </span>
        </div>
      </div>
      <ActivitySection />
    </>
  );
}

export default function AdminPanelPage() {
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const pending = useSelector(selectPendingCircuits);
  const reports = useSelector(selectAdminReports);
  const loaded = useSelector(selectAdminLoaded);
  const tab = TABS.find((t) => t.id === params.get('tab')) || TABS[0];
  const go = (id) => setParams(id === 'overview' ? {} : { tab: id });
  const counts = { review: pending.length, reports: reports.length };

  useEffect(() => {
    dispatch(fetchPending());
    dispatch(fetchReports());
  }, [dispatch]);

  return (
    <div className="adm">
      <aside className="adm-side">
        <Link to="/" className="brand">
          <BrandMark />
          <b>Techomato Labs</b>
        </Link>
        <span className="badge">Admin</span>
        <nav className="adm-nav" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab.id === t.id ? 'on' : ''}
              aria-current={tab.id === t.id ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.label}
              {counts[t.id] > 0 && <span className="adm-count">{counts[t.id]}{t.id === 'reports' && counts.reports >= REPORTS_SHOWN ? '+' : ''}</span>}
            </button>
          ))}
        </nav>
        <button className="btn adm-out" onClick={() => dispatch(adminLogout())}>
          Log out
        </button>
      </aside>
      <main className="adm-main">
        <div className="head">
          <div>
            <h1>{tab.title}</h1>
            <p>{tab.sub}</p>
          </div>
        </div>
        {tab.id === 'overview' && (
          <Overview pending={pending} reports={reports} loaded={loaded} go={go} />
        )}
        {tab.id === 'review' && <PendingSection />}
        {tab.id === 'reports' && <ReportsSection />}
        {tab.id === 'users' && <UsersSection />}
      </main>
    </div>
  );
}
