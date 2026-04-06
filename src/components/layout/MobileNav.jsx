import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, CheckSquare, Calendar, Users,
  MoreHorizontal, X, BarChart3, Shield, Clapperboard,
  UserCheck, FileText, Receipt, Mail, MonitorSmartphone, TrendingUp
} from "lucide-react";

const MAIN_TABS = [
  { path: "/Dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/Tasks", label: "Tasks", icon: CheckSquare },
  { path: "/Editorial", label: "Calendar", icon: Calendar },
  { path: "/Clients", label: "Clients", icon: Users },
];

const MORE_ITEMS = [
  { path: "/Freelancers", label: "Freelancers", icon: UserCheck },
  { path: "/VideoEditing", label: "Video", icon: Clapperboard },
  { path: "/Outreach", label: "Outreach", icon: Mail },
  { path: "/Invoices", label: "Invoices", icon: Receipt },
  { path: "/Contracts", label: "Contracts", icon: FileText },
  { path: "/FreelancerAdmin", label: "FL Portal", icon: MonitorSmartphone },
  { path: "/Admin", label: "Admin", icon: Shield },
];

export default function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some(i => i.path === location.pathname);

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
        style={{
          backgroundColor: 'var(--navy)',
          borderTop: '1px solid var(--navy-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {MAIN_TABS.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMoreOpen(false)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
              style={{ color: isActive ? 'var(--brand)' : 'var(--navy-muted)' }}
            >
              <Icon className="w-5 h-5" />
              <span style={{ fontSize: '9px', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{item.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
          style={{ color: isMoreActive || moreOpen ? 'var(--brand)' : 'var(--navy-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
          <span style={{ fontSize: '9px', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>More</span>
        </button>
      </nav>

      {/* More sheet — slides up */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div
            className="fixed left-0 right-0 z-40 md:hidden"
            style={{
              bottom: `calc(56px + env(safe-area-inset-bottom))`,
              backgroundColor: 'var(--navy)',
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid var(--navy-border)',
              padding: '16px 16px 8px',
            }}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: 'var(--navy-border)',
              margin: '0 auto 16px',
            }} />
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--navy-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, paddingLeft: 4 }}>
              More pages
            </p>
            <div className="grid grid-cols-4 gap-2">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                    style={{
                      background: isActive ? 'var(--brand-soft)' : 'rgba(255,255,255,0.05)',
                      color: isActive ? 'var(--brand)' : 'var(--navy-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon className="w-5 h-5" />
                    <span style={{ fontSize: '9px', fontFamily: "'DM Mono', monospace", fontWeight: 500, textAlign: 'center' }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}