import { useState } from "react";
import { supabase } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, CheckCircle2 } from "lucide-react";

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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('freelancers')
        .update({
          name: form.name,
          role: form.role,
          status: form.status,
          notes: form.notes,
          phone: form.phone,
        })
        .eq('id', freelancerProfile.id);

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

  if (!freelancerProfile) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-sm">Freelancer profile not set up yet.</p>
        <p className="text-xs mt-1">Contact the Unchain Studio team.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {(form.name || "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{form.name || user?.full_name}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <span className={`inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full border font-medium ${
            form.status === "Actif"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-red-100 text-red-700 border-red-200"
          }`}>
            {form.status === "Actif" ? "Available" : "Unavailable"}
          </span>
        </div>
      </div>

      {/* Availability */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Availability</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setForm(f => ({ ...f, status: "Actif" }))}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              form.status === "Actif"
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "border-slate-100 text-slate-400 hover:border-slate-200"
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setForm(f => ({ ...f, status: "Indisponible" }))}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              form.status === "Indisponible"
                ? "bg-red-100 text-red-700 border-red-200"
                : "border-slate-100 text-slate-400 hover:border-slate-200"
            }`}
          >
            Unavailable
          </button>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Personal Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Display name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} />
          </div>
          <div>
            <Label className="text-xs">Role / Title</Label>
            <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Video Editor" maxLength={100} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+358 ..." maxLength={30} />
        </div>
        <div>
          <Label className="text-xs">Bio</Label>
          <Textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="Short bio, specialties, tools you use..."
            maxLength={2000}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full bg-slate-800 hover:bg-slate-700">
        {saved ? (
          <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Saved!</>
        ) : saving ? (
          "Saving..."
        ) : (
          <><Save className="w-4 h-4 mr-2" /> Save profile</>
        )}
      </Button>
    </div>
  );
}
