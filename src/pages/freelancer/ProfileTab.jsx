import { useState } from "react";
import { supabase } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, CheckCircle2, User, Mail, Lock, Briefcase, Phone } from "lucide-react";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

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
    name: freelancerProfile?.name || user?.full_name || "",
    role: freelancerProfile?.role || "",
    status: freelancerProfile?.status || "Actif",
    notes: freelancerProfile?.notes || "",
    phone: freelancerProfile?.phone || "",
  });

  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('freelancers')
        .update({ name: form.name, role: form.role, status: form.status, notes: form.notes, phone: form.phone })
        .eq('id', freelancerProfile.id)
        .select('id');
      if (updateError) throw new Error(updateError.message);
      onProfileUpdate?.({ ...freelancerProfile, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail || newEmail === user?.email) return;
    setEmailLoading(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailMsg(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Confirmation sent — check your inbox.' }
    );
    setEmailLoading(false);
  };

  const handlePasswordChange = async () => {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: "Passwords don't match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: "Minimum 6 characters." });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Password updated successfully.' }
    );
    setPasswordLoading(false);
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  };

  if (!freelancerProfile) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-sm">Freelancer profile not set up yet.</p>
        <p className="text-xs mt-1">Contact the Unchain Studio team.</p>
      </div>
    );
  }

  const initial = (form.name || "?").charAt(0).toUpperCase();
  const statusInfo = {
    "Actif":   { label: "Available", classes: "bg-emerald-100 text-emerald-700" },
    "En pause":{ label: "On hold",   classes: "bg-amber-100 text-amber-700" },
    "Inactif": { label: "Inactive",  classes: "bg-red-100 text-red-600" },
  };
  const current = statusInfo[form.status] || statusInfo["Actif"];

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-10">

      {/* ── Avatar + identity ─────────────────────────────── */}
      <div className="flex items-center gap-4 px-1 pt-2 pb-1">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-base truncate">{form.name || "—"}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${current.classes}`}>
            {current.label}
          </span>
        </div>
      </div>

      {/* ── Availability ──────────────────────────────────── */}
      <Section icon={User} title="Availability">
        <div className="flex gap-2">
          {[
            { val: "Actif",   label: "Available", on: "bg-emerald-500 text-white border-emerald-500" },
            { val: "En pause",label: "On hold",   on: "bg-amber-400 text-white border-amber-400" },
            { val: "Inactif", label: "Inactive",  on: "bg-slate-700 text-white border-slate-700" },
          ].map(({ val, label, on }) => (
            <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                form.status === val ? on : "border-slate-100 text-slate-400 hover:border-slate-200 bg-white"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Personal Info ─────────────────────────────────── */}
      <Section icon={Briefcase} title="Profile">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display name">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} className="h-9 text-sm" />
            </Field>
            <Field label="Role / Title">
              <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Video Editor…" maxLength={100} className="h-9 text-sm" />
            </Field>
          </div>
          <Field label="Phone">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 …" maxLength={30} className="h-9 text-sm" />
          </Field>
          <Field label="Bio">
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} placeholder="Specialties, tools, experience…" maxLength={2000} className="text-sm resize-none" />
          </Field>
        </div>

        {error && <p className="mt-3 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className={`mt-4 w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-60"
          }`}>
          {saved
            ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
            : saving
            ? "Saving…"
            : <><Save className="w-4 h-4" /> Save profile</>}
        </button>
      </Section>

      {/* ── Account security ──────────────────────────────── */}
      <Section icon={Mail} title="Email address">
        <div className="space-y-3">
          <Field label="Email">
            <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-9 text-sm" />
          </Field>
          <Msg msg={emailMsg} />
          <button onClick={handleEmailChange} disabled={!newEmail || newEmail === user?.email || emailLoading}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {emailLoading ? "Sending…" : "Update email"}
          </button>
        </div>
      </Section>

      <Section icon={Lock} title="Password">
        <div className="space-y-3">
          <Field label="New password">
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm" />
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm" />
          </Field>
          <Msg msg={passwordMsg} />
          <button onClick={handlePasswordChange} disabled={!newPassword || !confirmPassword || passwordLoading}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {passwordLoading ? "Updating…" : "Update password"}
          </button>
        </div>
      </Section>

    </div>
  );
}
