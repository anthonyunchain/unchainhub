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

  const cardHeader = (Icon, title) => (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50">
      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-slate-500" />
      </div>
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">{title}</span>
    </div>
  );

  const fieldLabel = (text) => (
    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{text}</label>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 2-col on desktop, 1-col on mobile */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* ── Identity + Availability ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {cardHeader(User, "Identity")}
          <div className="p-4 flex flex-col gap-4">
            {/* Avatar row */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-base truncate">{form.name || "—"}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
                <span className={`inline-block mt-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${currentStatus.active}`}>
                  {currentStatus.label}
                </span>
              </div>
            </div>

            {/* Availability toggle */}
            <div className="space-y-2">
              {fieldLabel("Availability")}
              <div className="flex gap-2">
                {statusOptions.map(({ val, label, active }) => (
                  <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                      form.status === val ? active : "border-slate-100 text-slate-400 hover:border-slate-200 bg-white"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Email ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {cardHeader(Mail, "Email address")}
          <div className="p-4 flex flex-col gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                {fieldLabel("Email")}
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-9 text-sm" />
              </div>
              <Msg msg={emailMsg} />
            </div>
            <button onClick={handleEmailChange} disabled={!newEmail || newEmail === user?.email || emailLoading}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              {emailLoading ? "Sending…" : "Update email"}
            </button>
          </div>
        </div>

        {/* ── Profile form ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {cardHeader(Briefcase, "Profile")}
          <div className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                {fieldLabel("Display name")}
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                {fieldLabel("Role / Title")}
                <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Video Editor…" className="h-9 text-sm" maxLength={100} />
              </div>
            </div>
            <div className="space-y-1.5">
              {fieldLabel("Phone")}
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 …" className="h-9 text-sm" maxLength={30} />
            </div>
            <div className="space-y-1.5">
              {fieldLabel("Bio")}
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Specialties, tools, experience…" maxLength={2000}
                rows={3} className="text-sm resize-none" />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <button onClick={handleSave} disabled={saving}
              className={`h-10 w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                saved ? "bg-emerald-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-60"
              }`}>
              {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? "Saving…" : <><Save className="w-4 h-4" /> Save profile</>}
            </button>
          </div>
        </div>

        {/* ── Password ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {cardHeader(Lock, "Password")}
          <div className="p-4 flex flex-col gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                {fieldLabel("New password")}
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                {fieldLabel("Confirm password")}
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm" />
              </div>
              <Msg msg={passwordMsg} />
            </div>
            <button onClick={handlePasswordChange} disabled={!newPassword || !confirmPassword || passwordLoading}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              {passwordLoading ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>

      </div>{/* end grid */}
    </div>
  );
}
