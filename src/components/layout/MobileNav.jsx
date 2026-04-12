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
          // Frosted glass core
          background: 'rgba(10, 14, 30, 0.55)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          // Layered border: top specular highlight + subtle outer glow
          border: '1px solid rgba(255,255,255,0.13)',
          boxShadow: [
            '0 0 0 0.5px rgba(255,255,255,0.06) inset',   // inner rim
            '0 8px 32px rgba(0,0,0,0.45)',                  // depth shadow
            '0 2px 8px rgba(0,0,0,0.3)',                    // close shadow
            '0 1px 0 rgba(255,255,255,0.12) inset',         // top specular line
          ].join(', '),
        }}
      >
        {/* Top specular shimmer strip */}
        <div style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0.25) 60%, transparent)',
          borderRadius: '0 0 2px 2px',
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
                  width: 48, height: 38,
                  borderRadius: 14,
                  background: 'linear-gradient(160deg, rgba(42,105,255,0.45) 0%, rgba(42,105,255,0.2) 100%)',
                  border: '1px solid rgba(42,105,255,0.5)',
                  boxShadow: '0 0 12px rgba(42,105,255,0.3), 0 1px 0 rgba(255,255,255,0.15) inset',
                  backdropFilter: 'blur(4px)',
                  top: '50%', transform: 'translateY(-54%)',
                }} />
              )}
              <Icon
                className="w-[18px] h-[18px] relative z-10"
                style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.38)', strokeWidth: isActive ? 2.2 : 1.8 }}
              />
              <span
                className="relative z-10"
                style={{
                  fontSize: '9px',
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.32)',
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
              width: 48, height: 38,
              borderRadius: 14,
              background: moreOpen
                ? 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)'
                : 'linear-gradient(160deg, rgba(42,105,255,0.45) 0%, rgba(42,105,255,0.2) 100%)',
              border: moreOpen ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(42,105,255,0.5)',
              boxShadow: moreOpen ? 'none' : '0 0 12px rgba(42,105,255,0.3), 0 1px 0 rgba(255,255,255,0.15) inset',
              top: '50%', transform: 'translateY(-54%)',
            }} />
          )}
          {moreOpen
            ? <X className="w-[18px] h-[18px] relative z-10" style={{ color: 'rgba(255,255,255,0.7)', strokeWidth: 2 }} />
            : <MoreHorizontal className="w-[18px] h-[18px] relative z-10" style={{ color: isMoreActive ? '#fff' : 'rgba(255,255,255,0.38)', strokeWidth: 1.8 }} />
          }
          <span
            className="relative z-10"
            style={{
              fontSize: '9px',
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: isMoreActive || moreOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.32)',
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
              background: 'rgba(10, 14, 30, 0.65)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.13)',
              boxShadow: [
                '0 0 0 0.5px rgba(255,255,255,0.06) inset',
                '0 16px 48px rgba(0,0,0,0.5)',
                '0 1px 0 rgba(255,255,255,0.12) inset',
              ].join(', '),
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
              color: 'rgba(255,255,255,0.3)',
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
                        ? 'linear-gradient(160deg, rgba(42,105,255,0.4) 0%, rgba(42,105,255,0.18) 100%)'
                        : 'rgba(255,255,255,0.05)',
                      border: isActive ? '1px solid rgba(42,105,255,0.45)' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: isActive ? '0 0 16px rgba(42,105,255,0.2)' : 'none',
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.45)', strokeWidth: isActive ? 2.2 : 1.8 }}
                    />
                    <span style={{
                      fontSize: '9px',
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: 500,
                      textAlign: 'center',
                      color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.38)',
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
