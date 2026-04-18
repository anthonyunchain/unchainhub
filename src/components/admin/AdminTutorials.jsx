import { useEffect, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";
import { getYouTubeId, getYouTubeThumbnail } from "@/lib/youtube";

const emptyForm = { id: null, title: "", description: "", youtube_url: "", category: "", position: 0 };

export default function AdminTutorials() {
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutorials")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load: " + error.message);
    setTutorials(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...emptyForm, position: tutorials.length }); setDialogOpen(true); };
  const openEdit = (t) => {
    setForm({
      id: t.id,
      title: t.title || "",
      description: t.description || "",
      youtube_url: t.youtube_url || "",
      category: t.category || "",
      position: t.position ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.youtube_url.trim()) return;
    if (!getYouTubeId(form.youtube_url)) {
      toast.error("Not a valid YouTube URL");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      youtube_url: form.youtube_url.trim(),
      category: form.category.trim() || null,
      position: Number(form.position) || 0,
    };
    const q = form.id
      ? supabase.from("tutorials").update(payload).eq("id", form.id)
      : supabase.from("tutorials").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Tutorial updated" : "Tutorial added");
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (t) => {
    const ok = await confirm({
      title: "Delete this tutorial?",
      description: "Clients will no longer see it.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("tutorials").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tutorial deleted");
    load();
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Tutorials" subtitle="Unlisted YouTube videos shown to clients">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> New tutorial
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 240 }} aria-hidden="true" />)}
        </div>
      ) : tutorials.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No tutorials yet"
          description="Paste an unlisted YouTube link — it will appear in every client's Tutorials tab."
          action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add first tutorial</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Tutorials">
          {tutorials.map(t => {
            const thumb = getYouTubeThumbnail(t.youtube_url, "hqdefault");
            return (
              <li key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="relative aspect-video bg-slate-100">
                  {thumb
                    ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-8 h-8 text-slate-300" aria-hidden="true" /></div>
                  }
                  <a
                    href={t.youtube_url} target="_blank" rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors"
                    aria-label={`Preview ${t.title} on YouTube`}
                  >
                    <span className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--brand)', color: '#fff' }}>
                      <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />
                    </span>
                  </a>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 leading-snug">{t.title}</h3>
                    {t.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>{t.category}</span>}
                  </div>
                  {t.description && <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>}
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <a href={t.youtube_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" aria-hidden="true" /> YouTube
                    </a>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(t)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label={`Edit ${t.title}`}>
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleDelete(t)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                        aria-label={`Delete ${t.title}`}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand" /> {form.id ? "Edit tutorial" : "New tutorial"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label htmlFor="tut-title">Title *</Label>
              <Input id="tut-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tut-url">YouTube URL * <span className="text-slate-400">(unlisted is fine)</span></Label>
              <Input id="tut-url" type="url" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} placeholder="https://youtu.be/…" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tut-category">Category</Label>
                <Input id="tut-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Getting started, Brief, Reports…" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="tut-position">Position</Label>
                <Input id="tut-position" type="number" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="tut-desc">Description</Label>
              <Textarea id="tut-desc" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this tutorial covers…" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.youtube_url.trim()}
                className="bg-brand hover:bg-brand/90 text-brand-foreground"
              >
                {saving ? "Saving…" : (form.id ? "Save" : "Add tutorial")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
