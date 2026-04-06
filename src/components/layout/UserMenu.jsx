import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LogOut, Settings } from "lucide-react";

export default function UserMenu({ userName, userEmail, initials }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "opacity 200ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 700,
            color: "#fff",
          }}
        >
          {initials}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            top: "72px",
            right: "20px",
            background: "var(--card)",
            borderRadius: "var(--card-radius)",
            boxShadow: "var(--card-shadow-hover)",
            border: "1px solid var(--divider)",
            zIndex: 9999,
            minWidth: 220,
          }}
        >
          <div style={{ padding: "12px 0" }}>
            <div
              style={{
                padding: "8px 14px",
                borderBottom: "1px solid var(--divider)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {userName}
              </p>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  color: "var(--muted)",
                  margin: "4px 0 0 0",
                }}
              >
                {userEmail}
              </p>
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                width: "100%",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--ink)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "background 150ms",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--divider)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Settings style={{ width: 14, height: 14, flexShrink: 0 }} />
              Settings
            </button>

            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#E8421A",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "background 150ms",
                borderTop: "1px solid var(--divider)",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#FEF0ED")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <LogOut style={{ width: 14, height: 14, flexShrink: 0 }} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}