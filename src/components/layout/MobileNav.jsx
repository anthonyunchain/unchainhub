import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, CheckSquare, Calendar, Lightbulb,
  MoreHorizontal, X, Shield, UserCheck, Users, Layers
} from "lucide-react";

const MAIN_TABS = [
  { path: "/Dashboard", label: "Home",     icon: LayoutDashboard },
  { path: "/Tasks",     label: "Tasks",    icon: CheckSquare },
  { path: "/Editorial", label: "Calendar", icon: Calendar },
  { path: "/Ideas",     label: "Ideas",    icon: Lightbulb },
];

const MORE_ITEMS = [
  { path: "/Clients",     label: "Clients",     icon: Users },
  { path: "/Freelancers", label: "Freelancers", icon: UserCheck },
  { path: "/Admin",       label: "Admin",       icon: Shield },
  { path: "/Services",    label: "Services",    icon: Layers },
];

export default function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some(i => i.path.split('?')[0] === location.pathname);

  return (
    <>
      {/* ── Liquid glass bottom nav ── */}
      <nav
        className="fixed left-4 right-4 z-50 flex md:hidden items-center"
        style={{
          bottom: `calc(12px + env(safe-area-inset-bottom))`,
          height: 64,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,1) inset',
        }}
      >
        {/* Top specular shimmer strip */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent)',
          pointerEvents: 'none',
        }} />

        {MAIN_TABS.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMoreOpen(false)}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative"
              style={{ textDecoration: 'none', height: '100%', borderRadius: 'inherit' }}
            >
              {/* Active glass bubble */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  width: 64, height: 52,
                  borderRadius: 16,
                  background: 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)',
                  boxShadow: '0 4px 12px rgba(42,105,255,0.35)',
                  top: '50%', transform: 'translateY(-50%)',
                }} />
              )}
              <Icon
                className="w-[19px] h-[19px] relative z-10"
                style={{ color: isActive ? '#fff' : 'rgba(30,40,70,0.5)', strokeWidth: isActive ? 2.2 : 1.8 }}
              />
              <span
                className="relative z-10"
                style={{
                  fontSize: '9px',
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: isActive ? '#fff' : 'rgba(30,40,70,0.5)',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-1 relative"
          style={{ background: 'none', border: 'none', cursor: 'pointer', height: '100%' }}
        >
          {(isMoreActive || moreOpen) && (
            <div style={{
              position: 'absolute',
              width: 64, height: 52,
              borderRadius: 16,
              background: 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)',
              boxShadow: '0 4px 12px rgba(42,105,255,0.35)',
              top: '50%', transform: 'translateY(-50%)',
            }} />
          )}
          {moreOpen
            ? <X className="w-[19px] h-[19px] relative z-10" style={{ color: isMoreActive ? '#fff' : 'rgba(30,40,70,0.5)', strokeWidth: 2 }} />
            : <MoreHorizontal className="w-[19px] h-[19px] relative z-10" style={{ color: isMoreActive ? '#fff' : 'rgba(30,40,70,0.5)', strokeWidth: 1.8 }} />
          }
          <span
            className="relative z-10"
            style={{
              fontSize: '9px',
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: isMoreActive || moreOpen ? '#fff' : 'rgba(30,40,70,0.5)',
            }}
          >
            More
          </span>
        </button>
      </nav>

      {/* ── More sheet ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={() => setMoreOpen(false)}
          />

          {/* Glass sheet */}
          <div
            className="fixed left-4 right-4 z-40 md:hidden"
            style={{
              bottom: `calc(88px + env(safe-area-inset-bottom))`,
              borderRadius: 24,
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.95)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
              padding: '20px 16px 16px',
            }}
          >
            {/* Top specular strip */}
            <div style={{
              position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.2) 60%, transparent)',
              pointerEvents: 'none',
            }} />

            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              color: 'rgba(30,40,70,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 12,
              paddingLeft: 4,
            }}>
              More
            </p>

            <div className="grid grid-cols-4 gap-2">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path.split('?')[0];
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3.5 relative"
                    style={{
                      textDecoration: 'none',
                      borderRadius: 16,
                      background: isActive
                        ? 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)'
                        : 'rgba(30,40,70,0.05)',
                      border: isActive ? 'none' : '1px solid rgba(30,40,70,0.08)',
                      boxShadow: isActive ? '0 4px 12px rgba(42,105,255,0.3)' : 'none',
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isActive ? '#fff' : 'rgba(30,40,70,0.55)', strokeWidth: isActive ? 2.2 : 1.8 }}
                    />
                    <span style={{
                      fontSize: '9px',
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: 500,
                      textAlign: 'center',
                      color: isActive ? '#fff' : 'rgba(30,40,70,0.55)',
                    }}>
                      {item.label}
                    </span>
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
