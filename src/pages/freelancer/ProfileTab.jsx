import { useState } from "react";
import { supabase } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Camera, Save, CheckCircle2, X } from "lucide-react";

export default function ProfileTab({ user, freelancerProfile, onProfileUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: freelancerProfile?.name || user?.full_name || "",
    role: freelancerProfile?.role || "",
    status: freelancerProfile?.status || "Actif",
    notes: freelancerProfile?.notes || "",
    phone: freelancerProfile?.phone || "",
    avatar_url: freelancerProfile?.avatar_url || "",
    specialties: freelancerProfile?.specialties || [],
  });

  const [newSpecialty, setNewSpecialty] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: updated, error: updateError } = await supabase
        .from('freelancers')
        .update({
          name: form.name,
          role: form.role,
          status: form.status,
          notes: form.notes,
          phone: form.phone,
          avatar_url: form.avatar_url,
          specialties: form.specialties,
        })
        .eq('id', freelancerProfile.id)
        .select()
        .single();

      if (updateError) throw new Error(updateError.message);

      onProfileUpdate?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, avatar_url: file_url }));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addSpecialty = () => {
    if (newSpecialty.trim()) {
      setForm(f => ({ ...f, specialties: [...(f.specialties || []), newSpecialty.trim()] }));
      setNewSpecialty("");
    }
  };

  const removeSpecialty = (idx) => {
    setForm(f => ({ ...f, specialties: f.specialties.filter((_, i) => i !== idx) }));
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
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative group">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="avatar" className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-2xl font-bold">
              {(form.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <label className={`absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? "opacity-100" : ""}`}>
            {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
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

      {/* Info */}
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

      {/* Skills */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Skills</h3>
        <div className="flex gap-2">
          <Input
            value={newSpecialty}
            onChange={e => setNewSpecialty(e.target.value)}
            placeholder="e.g. Premiere Pro, Motion design..."
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSpecialty())}
            maxLength={50}
          />
          <Button type="button" variant="outline" size="sm" onClick={addSpecialty}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(form.specialties || []).map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
              {s}
              <button onClick={() => removeSpecialty(i)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* Save */}
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
