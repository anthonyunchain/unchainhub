import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import PageHeader from "@/components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Link2, Image, Paperclip, X, RefreshCw, Lightbulb, Repeat2 } from "lucide-react";

const POST_TYPES = ["Reel", "Story", "Carousel"];
const PLATFORMS = ["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "Other"];

const TYPE_COLORS = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

const EMPTY_IDEA = {
  category: "specific",
  title: "",
  caption: "",
  post_type: "Reel",
  platform: "Instagram",
  reference_url: "",
  reference_file_url: null,
  reference_file_name: null,
  attached_file_url: null,
  attached_file_name: null,
};

async function fetchIdeas() {
  const { data, error } = await supabase
    .from("content_ideas")
    .select("*")
    .is("used_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export default function ContentIdeas() {
  const qc = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIdea, setEditIdea] = useState(null);
  const [uploading, setUploading] = useState(false);
  const refFileRef = useRef(null);
  const attachFileRef = useRef(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.filter({ status: "Actif" }),
  });

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["content-ideas"],
    queryFn: fetchIdeas,
  });

  const saveMut = useMutation({
    mutationFn: async (idea) => {
      if (idea.id) {
        const { id, created_at, used_at, ...d } = idea;
        const { error } = await supabase.from("content_ideas").update(d).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_ideas").insert(idea);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-ideas"] });
      setDialogOpen(false);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("content_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-ideas"] }),
    onError: (e) => toast.error("Error: " + e.message),
  });

  const openNew = (client_name) => {
    setEditIdea({ ...EMPTY_IDEA, client_name: client_name !== "all" ? client_name : "" });
    setDialogOpen(true);
  };

  const openEdit = (idea) => {
    setEditIdea({ ...idea });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editIdea.title.trim()) return toast.error("Title is required");
    if (!editIdea.client_name) return toast.error("Select a client");
    saveMut.mutate(editIdea);
  };

  const uploadFile = async (file, field) => {
    if (!file) return;
    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`File exceeds ${MAX_MB} MB`);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${field}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("content-ideas").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("content-ideas").getPublicUrl(path);
      setEditIdea(prev => ({
        ...prev,
        [`${field}_url`]: publicUrl,
        [`${field}_name`]: file.name,
      }));
    } catch (e) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const clientIdeas = selectedClient === "all" ? ideas : ideas.filter(i => i.client_name === selectedClient);
  const generalIdeas = clientIdeas.filter(i => i.category === "general");
  const specificIdeas = clientIdeas.filter(i => i.category === "specific");

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader title="Content Ideas" subtitle="Idea bank per client — drag & drop into the editorial calendar">
        <Button onClick={() => openNew(selectedClient)} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" />Add idea
        </Button>
      </PageHeader>

      {/* Client selector */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setSelectedClient("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${selectedClient === "all" ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
        >
          All clients
        </button>
        {clients.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedClient(c.company_name)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${selectedClient === c.company_name ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
          >
            {c.company_name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* General ideas */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Repeat2 className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-800">General ideas</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{generalIdeas.length}</span>
              <span className="text-xs text-slate-400">— Recurring templates, never consumed</span>
            </div>
            {generalIdeas.length === 0 ? (
              <p className="text-sm text-slate-400 pl-6">No general ideas yet for this client.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {generalIdeas.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
                ))}
              </div>
            )}
          </section>

          {/* Specific ideas */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-800">Specific ideas</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{specificIdeas.length}</span>
              <span className="text-xs text-slate-400">— One-shot, consumed when added to calendar</span>
            </div>
            {specificIdeas.length === 0 ? (
              <p className="text-sm text-slate-400 pl-6">No specific ideas yet for this client.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {specificIdeas.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editIdea?.id ? "Edit idea" : "New idea"}</DialogTitle>
          </DialogHeader>
          {editIdea && (
            <div className="space-y-4 mt-2">
              {/* Client + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Client *</Label>
                  <Select value={editIdea.client_name || ""} onValueChange={v => setEditIdea(p => ({ ...p, client_name: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select value={editIdea.category} onValueChange={v => setEditIdea(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General (recurring)</SelectItem>
                      <SelectItem value="specific">Specific (one-shot)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Title */}
              <div>
                <Label>Title *</Label>
                <Input value={editIdea.title} onChange={e => setEditIdea(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Lunch recommendation carousel" />
              </div>

              {/* Caption */}
              <div>
                <Label>Caption</Label>
                <Textarea value={editIdea.caption || ""} onChange={e => setEditIdea(p => ({ ...p, caption: e.target.value }))} rows={3} placeholder="Pre-written caption…" />
              </div>

              {/* Type + Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Post type</Label>
                  <Select value={editIdea.post_type} onValueChange={v => setEditIdea(p => ({ ...p, post_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{POST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Platform</Label>
                  <Select value={editIdea.platform} onValueChange={v => setEditIdea(p => ({ ...p, platform: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reference */}
              <div>
                <Label>Reference (URL or image)</Label>
                <div className="space-y-2">
                  <Input
                    value={editIdea.reference_url || ""}
                    onChange={e => setEditIdea(p => ({ ...p, reference_url: e.target.value }))}
                    placeholder="https://..."
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => refFileRef.current?.click()} disabled={uploading}>
                      <Image className="w-3.5 h-3.5 mr-1" />Upload image
                    </Button>
                    {editIdea.reference_file_name && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        {editIdea.reference_file_name}
                        <button onClick={() => setEditIdea(p => ({ ...p, reference_file_url: null, reference_file_name: null }))} className="text-slate-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    <input ref={refFileRef} type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e.target.files[0], "reference_file")} />
                  </div>
                  {editIdea.reference_file_url && (
                    <img src={editIdea.reference_file_url} alt="Reference" className="h-24 w-auto rounded-lg object-cover border border-slate-200" />
                  )}
                </div>
              </div>

              {/* Attached file */}
              <div>
                <Label>Attached file (ready to post)</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => attachFileRef.current?.click()} disabled={uploading}>
                    <Paperclip className="w-3.5 h-3.5 mr-1" />Upload file
                  </Button>
                  {editIdea.attached_file_name && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {editIdea.attached_file_name}
                      <button onClick={() => setEditIdea(p => ({ ...p, attached_file_url: null, attached_file_name: null }))} className="text-slate-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <input ref={attachFileRef} type="file" accept="video/*,image/*" className="hidden" onChange={e => uploadFile(e.target.files[0], "attached_file")} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                {editIdea.id
                  ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { deleteMut.mutate(editIdea.id); setDialogOpen(false); }}>
                      <Trash2 className="w-4 h-4 mr-1" />Delete
                    </Button>
                  : <div />
                }
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground" disabled={saveMut.isPending || uploading}>
                    {saveMut.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IdeaCard({ idea, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-800 leading-tight">{idea.title}</h3>
        <button onClick={() => onEdit(idea)} className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[idea.post_type] || "bg-slate-100 text-slate-600"}`}>
          {idea.post_type}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{idea.platform}</span>
        <span className="text-[10px] text-slate-400">{idea.client_name}</span>
      </div>

      {idea.caption && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2">{idea.caption}</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        {idea.reference_url && (
          <a href={idea.reference_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
            <Link2 className="w-3 h-3" />Ref
          </a>
        )}
        {idea.reference_file_url && (
          <img src={idea.reference_file_url} alt="" className="h-8 w-8 rounded object-cover border border-slate-200" />
        )}
        {idea.attached_file_name && (
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            <Paperclip className="w-3 h-3" />{idea.attached_file_name.slice(0, 20)}
          </span>
        )}
      </div>
    </div>
  );
}
