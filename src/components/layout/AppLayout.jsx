import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Topbar from "./Topbar.jsx";
import MobileNav from "./MobileNav.jsx";

const PAGE_TITLES = {
  '/Dashboard':           'Dashboard',
  '/Pipeline':            'Pipeline',
  '/Clients':             'Clients',
  '/ClientDetail':        'Client',
  '/Services':            'Services',
  '/Outreach':            'Outreach',
  '/Contracts':           'Contracts',
  '/Invoices':            'Invoices',
  '/Freelancers':         'Freelancers',
  '/Finance':             'Finance',
  '/Editorial':           'Editorial',
  '/Reports':             'Reports',
  '/VideoEditing':        'Video Editing',
  '/Shootings':           'Shootings',
  '/ShootingsToOrganize': 'Shootings to Organize',
  '/Tasks':               'Tasks',
  '/Admin':               'Admin',
  '/ContentDescriptions': 'Content Descriptions',
  '/FreelancerAdmin':     'Freelancer Admin',
  '/Ideas':               'Ideas',
  '/Notes':               'Notes',
  '/MeetingNotes':        'Meeting Notes',
  '/Planning':            'Planning',
  '/CRM':                 'CRM',
  '/ContentIdeas':        'Content Ideas',
  '/FreelancerShop':      'Freelancer Shop',
};

export default function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    const name = PAGE_TITLES[location.pathname] || 'Unchain Hub';
    document.title = `${name} — Unchain Hub`;
  }, [location.pathname]);
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', position: 'relative' }}>
      {/* Background blobs — hidden on mobile for perf */}
      <div className="hidden md:block" style={{ position: 'fixed', top: '-80px', right: '-80px', width: 400, height: 400, borderRadius: '50%', background: 'rgba(42,105,255,0.12)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div className="hidden md:block" style={{ position: 'fixed', bottom: '-60px', left: '-60px', width: 350, height: 350, borderRadius: '50%', background: 'rgba(168,130,255,0.10)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div className="hidden md:block" style={{ position: 'fixed', top: '45%', right: '15%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,180,130,0.08)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '100%',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))',
          paddingTop: 'max(24px, env(safe-area-inset-top))',
        }}
        className="pb-36 md:pb-8 sm:px-5"
      >
        <Topbar />
        <main>
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <MobileNav />
    </div>
  );
}