import { useState, useRef, useEffect } from "react";
import { base44, supabase } from "@/api/base44Client";
import { LogOut, Settings, Sun, Moon, Bell, BellOff } from "lucide-react";
import { registerPush, unregisterPush } from "@/lib/pushNotifications";
import { useTheme } from "@/lib/useTheme";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function SettingsDialog({ open, onOpenChange }) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleEmailChange = async () => {
    if (!email) return;
    setEmailLoading(true);
    setEmailMsg("");
    const { error } = await supabase.auth.updateUser({ email });
    setEmailMsg(error ? error.message : "Confirmation email sent. Check your inbox.");
    setEmailLoading(false);
    if (!error) setEmail("");
  };

  const handlePasswordChange = async () => {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) { setPasswordMsg("Passwords don't match."); return; }
    if (newPassword.length < 6) { setPasswordMsg("Password must be at least 6 characters."); return; }
    setPasswordLoading(true);
    setPasswordMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Password updated successfully.");
    setPasswordLoading(false);
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  };

  const handleClose = () => {
    setEmail(""); setNewPassword(""); setConfirmPassword("");
    setEmailMsg(""); setPasswordMsg("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Account settings</DialogTitle></DialogHeader>
        <div className="space-y-6 mt-2">
          {/* Change email */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Change email address</h3>
            <div>
              <Label>New email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="new@email.com"
              />
            </div>
            {emailMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${emailMsg.includes("sent") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {emailMsg}
              </p>
            )}
            <Button
              onClick={handleEmailChange}
              disabled={!email || emailLoading}
              className="w-full bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {emailLoading ? "Sending…" : "Update email"}
            </Button>
          </div>

          {/* Change password */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Change password</h3>
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {passwordMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${passwordMsg.includes("successfully") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {passwordMsg}
              </p>
            )}
            <Button
              onClick={handlePasswordChange}
              disabled={!newPassword || !confirmPassword || passwordLoading}
              className="w-full bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {passwordLoading ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UserMenu({ userName, userEmail, initials, onSettingsClick }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => Notification.permission === 'granted');
  const [pushLoading, setPushLoading] = useState(false);
  const menuRef = useRef(null);
  const { dark, toggle } = useTheme();

  const togglePush = async () => {
    setPushLoading(true);
    if (pushEnabled) {
      await unregisterPush();
      setPushEnabled(false);
    } else {
      const sub = await registerPush();
      setPushEnabled(!!sub);
    }
    setPushLoading(false);
  };

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
    <>
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
              <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--divider)" }}>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                  {userName}
                </p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--muted)", margin: "4px 0 0 0" }}>
                  {userEmail}
                </p>
              </div>

              <button
                onClick={toggle}
                style={{
                  width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "transparent", border: "none", cursor: "pointer", fontSize: "13px",
                  color: "var(--ink)", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "background 150ms", textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--divider)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {dark ? <Sun style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Moon style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  {dark ? "Light mode" : "Dark mode"}
                </span>
                <span style={{
                  width: 32, height: 18, borderRadius: 9, background: dark ? "var(--brand)" : "var(--subtle)",
                  position: "relative", flexShrink: 0, transition: "background 200ms",
                }}>
                  <span style={{
                    position: "absolute", top: 2, left: dark ? 16 : 2, width: 14, height: 14,
                    borderRadius: "50%", background: "#fff", transition: "left 200ms",
                  }} />
                </span>
              </button>

              {'Notification' in window && (
                <button
                  onClick={togglePush}
                  disabled={pushLoading}
                  style={{
                    width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "transparent", border: "none", cursor: "pointer", fontSize: "13px",
                    color: "var(--ink)", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "background 150ms", textAlign: "left",
                    opacity: pushLoading ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--divider)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {pushEnabled ? <Bell style={{ width: 14, height: 14, flexShrink: 0 }} /> : <BellOff style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    {pushEnabled ? "Notifications on" : "Notifications off"}
                  </span>
                  <span style={{
                    width: 32, height: 18, borderRadius: 9, background: pushEnabled ? "var(--brand)" : "var(--subtle)",
                    position: "relative", flexShrink: 0, transition: "background 200ms",
                  }}>
                    <span style={{
                      position: "absolute", top: 2, left: pushEnabled ? 16 : 2, width: 14, height: 14,
                      borderRadius: "50%", background: "#fff", transition: "left 200ms",
                    }} />
                  </span>
                </button>
              )}

              <button
                onClick={() => { setOpen(false); onSettingsClick ? onSettingsClick() : setSettingsOpen(true); }}
                style={{
                  width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                  background: "transparent", border: "none", cursor: "pointer", fontSize: "13px",
                  color: "var(--ink)", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "background 150ms", textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--divider)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Settings style={{ width: 14, height: 14, flexShrink: 0 }} />
                Settings
              </button>

              <button
                onClick={handleLogout}
                style={{
                  width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                  background: "transparent", border: "none", cursor: "pointer", fontSize: "13px",
                  color: "#E8421A", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "background 150ms",
                  borderTop: "1px solid var(--divider)", textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF0ED")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut style={{ width: 14, height: 14, flexShrink: 0 }} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
