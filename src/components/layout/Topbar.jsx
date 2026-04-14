import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Menu, X } from "lucide-react";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

const NAV_LINKS = [
  { path: "/Dashboard",      label: "Dashboard"  },
  { path: "/Tasks",          label: "Tasks"      },
  { path: "/Editorial",      label: "Calendars"  },
  { path: "/FreelancerAdmin",label: "Freelancers"},
  { path: "/Clients",        label: "Clients"    },
  { path: "/Admin",          label: "Admin"      },
];

export default function Topbar() {
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Helsinki" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUserName(u?.full_name || u?.email || "");
      setUserEmail(u?.email || "");
      setUserId(u?.id || null);
    }).catch(() => {});
  }, []);

  const initials = userName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "US";
  const today = format(new Date(), "EEE, MMM d", { locale: enUS });

  return (
    <nav style={{ padding: '0 0 20px 0', position: 'relative', zIndex: 10 }}>
      <div className="flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/Dashboard" className="flex items-center gap-2.5 shrink-0" style={{ textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>U</span>
          </div>
          <span style={{ fontSize: 'clamp(13px, 4vw, 15px)', fontWeight: 800, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.2px' }}>
            Unchain Studio
          </span>
        </Link>

        {/* Center nav pills — desktop only */}
        <div className="hidden lg:flex items-center gap-1 p-1" style={{
          background: 'var(--card)',
          borderRadius: 'var(--pill-radius)',
          boxShadow: 'var(--card-shadow)',
        }}>
          {NAV_LINKS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '6px 14px',
                  borderRadius: 'var(--pill-radius)',
                  background: isActive ? 'var(--brand)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--muted)',
                  textDecoration: 'none',
                  transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right: date + bell + avatar — desktop */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'var(--muted)',
            background: 'var(--card)',
            boxShadow: 'var(--card-shadow)',
            borderRadius: 'var(--pill-radius)',
            padding: '7px 14px',
          }}>
            {today} · {time}
          </div>
          <NotificationBell recipientId={userId}  />
          <UserMenu userName={userName} userEmail={userEmail} initials={initials} />
        </div>

        {/* Mobile: time + bell + avatar */}
        <div className="flex md:hidden items-center gap-2">
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{time}</div>
          <NotificationBell recipientId={userId}  />
          <UserMenu userName={userName} userEmail={userEmail} initials={initials} />
        </div>
      </div>
    </nav>
  );
}