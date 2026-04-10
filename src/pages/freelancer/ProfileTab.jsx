import { useState } from "react";
import { supabase } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, CheckCircle2, User, Mail, Lock, Briefcase } from "lucide-react";

function Msg({ msg }) {
  if (!msg) return null;
  return (
    <p className={`text-xs px-3 py-2 rounded-xl ${msg.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
      {msg.text}
    </p>
  );
}

export default function ProfileTab({ user, freelancerProfile, onProfileUpdate }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name:   freelancerProfile?.name   || user?.full_name || "",
    role:   freelancerProfile?.role   || "",
    status: freelancerProfile?.status || "Actif",
    notes:  freelancerProfile?.notes  || "",
    phone:  freelancerProfile?.phone  || "",
  });

  const [newEmail, setNewEmail]           = useState(user?.email || "");
  const [emailMsg, setEmailMsg]           = useState(null);
  const [emailLoading, setEmailLoading]   = useState(false);

  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg]         = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.from('freelancers')
        .update({ name: form.name, role: form.role, status: form.status, notes: form.notes, phone: form.phone })
        .eq('id', freelancerProfile.id).select('id');
      if (e) throw new Error(e.message);
      onProfileUpdate?.({ ...freelancerProfile, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleEmailChange = async () => {
    if (!newEmail || newEmail === user?.email) return;
    setEmailLoading(true); setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailMsg(error
      ? { type: 'error',   text: error.message }
      : { type: 'success', text: 'Confirmation sent — check your inbox.' });
    setEmailLoading(false);
  };

  const handlePasswordChange = async () => {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: "Passwords don't match." }); return; }
    if (newPassword.length < 6)          { setPasswordMsg({ type: 'error', text: "Minimum 6 characters." }); return; }
    setPasswordLoading(true); setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error
      ? { type: 'error',   text: error.message }
      : { type: 'success', text: 'Password updated successfully.' });
    setPasswordLoading(false);
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  };

  if (!freelancerProfile) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <p className="text-sm">Freelancer profile not set up yet. Contact the Unchain Studio team.</p>
    </div>
  );

  const initial = (form.name || "?").charAt(0).toUpperCase();
  const statusOptions = [
    { val: "Actif",    label: "Available", active: "bg-emerald-500 text-white border-emerald-500" },
    { val: "En pause", label: "On hold",   active: "bg-amber-400  text-white border-amber-400"   },
    { val: "Inactif",  label: "Inactive",  active: "bg-slate-700  text-white border-slate-700"   },
  ];
  const currentStatus = statusOptions.find(o => o.val === form.status) || statusOptions[0];

  return (
    <div className="h-full flex items-start justify-center py-4 px-4">
      <div className="w-full max-w-4xl grid grid-cols-2 gap-4 h-full" style={{ maxHeight: 'calc(100vh - 140px)' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-0">

          {/* Identity card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-white text-lg font-bold shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{form.name || "—"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <span className={`ml-auto shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${currentStatus.active}`}>
              {currentStatus.label}
            </span>
          </div>

          {/* Availability */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Availability</span>
            </div>
            <div className="p-3 flex gap-2">
              {statusOptions.map(({ val, label, active }) => (
                <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                    form.status === val ? active : "border-slate-100 text-slate-400 hover:border-slate-200 bg-white"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <Briefcase className="w-3 h-3 text-slate-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Profile</span>
            </div>
            <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Display name</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" maxLength={100} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Role / Title</label>
                  <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Video Editor…" className="h-8 text-sm" maxLength={100} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Phone</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 …" className="h-8 text-sm" maxLength={30} />
              </div>
              <div className="space-y-1 flex-1 flex flex-col min-h-0">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bio</label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Specialties, tools, experience…" maxLength={2000}
                  className="text-sm resize-none flex-1 min-h-0" style={{ minHeight: 0 }} />
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <button onClick={handleSave} disabled={saving}
                className={`h-9 w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shrink-0 ${
                  saved ? "bg-emerald-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-60"
                }`}>
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                  : saving ? "Saving…"
                  : <><Save className="w-4 h-4" /> Save profile</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Email */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <Mail className="w-3 h-3 text-slate-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Email address</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-8 text-sm" />
              </div>
              <Msg msg={emailMsg} />
              <button onClick={handleEmailChange} disabled={!newEmail || newEmail === user?.email || emailLoading}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {emailLoading ? "Sending…" : "Update email"}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <Lock className="w-3 h-3 text-slate-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Password</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">New password</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Confirm password</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-8 text-sm" />
              </div>
              <Msg msg={passwordMsg} />
              <button onClick={handlePasswordChange} disabled={!newPassword || !confirmPassword || passwordLoading}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {passwordLoading ? "Updating…" : "Update password"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
