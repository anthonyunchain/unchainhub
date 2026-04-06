import { Outlet } from "react-router-dom";
import Topbar from "./Topbar.jsx";
import MobileNav from "./MobileNav.jsx";

export default function AppLayout() {
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
          padding: '20px',
          paddingTop: 'max(28px, env(safe-area-inset-top))',
        }}
        className="pb-24 md:pb-5"
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