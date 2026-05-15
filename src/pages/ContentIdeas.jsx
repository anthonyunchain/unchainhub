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
import { Plus, Trash2, Pencil, Link2, Image, Paperclip, X, RefreshCw, Lightbulb, Repeat2, Sparkles, Hash, ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
  const [generalOpen, setGeneralOpen] = useState(true);
  const [specificOpen, setSpecificOpen] = useState(true);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [scrapeJobId, setScrapeJobId] = useState(null);
  const [scraping, setScraping] = useState(false);
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

  const { data: allTrends = [] } = useQuery({
    queryKey: ["content-trends"],
    queryFn: () => base44.entities.ContentTrend.list("-scraped_at"),
    enabled: trendsOpen,
  });

  useQuery({
    queryKey: ["scrape-job", scrapeJobId],
    queryFn: () => base44.entities.ScrapeJob.filter({ id: scrapeJobId }).then(rows => rows[0]),
    enabled: !!scrapeJobId,
    refetchInterval: (data) => (data?.status === "running" ? 8000 : false),
    onSuccess: (job) => {
      if (job?.status === "done") {
        setScraping(false);
        qc.invalidateQueries({ queryKey: ["content-trends"] });
        toast.success(`✓ Scraping done — ${job.results_count || 0} results imported`);
        setScrapeJobId(null);
      } else if (job?.status === "error") {
        setScraping(false);
        toast.error("Apify error: " + (job.error_message || "Check logs"));
        setScrapeJobId(null);
      }
    },
  });

  const handleScrape = async () => {
    setScraping(true);
    try {
      const period = format(new Date(), "yyyy-MM");
      const { data } = await base44.functions.invoke("apifyStartScrape", { type: "social_stats", period });
      if (data?.error) throw new Error(data.error);
      if (data?.jobId) {
        setScrapeJobId(data.jobId);
        toast.info(`Scraping started for ${data.clientsCount || 0} client(s) — results in a few minutes`);
      }
    } catch (e) {
      setScraping(false);
      toast.error("Failed to start scrape: " + (e?.message || "Unknown error"));
    }
  };

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
        <div className="space-y-6">
          {/* General ideas */}
          <section>
            <button
              onClick={() => setGeneralOpen(o => !o)}
              className="w-full flex items-center gap-2 mb-3 group"
            >
              <Repeat2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-800">General ideas</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{generalIdeas.length}</span>
              <span className="text-xs text-slate-400">— Recurring templates, never consumed</span>
              <ChevronDown className={`w-4 h-4 text-slate-300 ml-auto transition-transform ${generalOpen ? "rotate-180" : ""}`} />
            </button>
            {generalOpen && (
              generalIdeas.length === 0 ? (
                <p className="text-sm text-slate-400 pl-6">No general ideas yet for this client.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {generalIdeas.map(idea => (
                    <IdeaCard key={idea.id} idea={idea} onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
                  ))}
                </div>
              )
            )}
          </section>

          {/* Specific ideas */}
          <section>
            <button
              onClick={() => setSpecificOpen(o => !o)}
              className="w-full flex items-center gap-2 mb-3 group"
            >
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-800">Specific ideas</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{specificIdeas.length}</span>
              <span className="text-xs text-slate-400">— One-shot, consumed when added to calendar</span>
              <ChevronDown className={`w-4 h-4 text-slate-300 ml-auto transition-transform ${specificOpen ? "rotate-180" : ""}`} />
            </button>
            {specificOpen && (
              specificIdeas.length === 0 ? (
                <p className="text-sm text-slate-400 pl-6">No specific ideas yet for this client.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {specificIdeas.map(idea => (
                    <IdeaCard key={idea.id} idea={idea} onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
                  ))}
                </div>
              )
            )}
          </section>

          {/* Apify trends */}
          {(() => {
            const clientTrends = allTrends.filter(t =>
              selectedClient === "all" || t.client_name === selectedClient
            );
            const latestByHashtag = Object.values(
              clientTrends.reduce((acc, t) => {
                const key = `${t.hashtag}-${t.platform}-${t.client_name}`;
                if (!acc[key] || t.period > acc[key].period) acc[key] = t;
                return acc;
              }, {})
            ).sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0)).slice(0, 12);

            return (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setTrendsOpen(o => !o)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
                    <h2 className="text-sm font-semibold text-slate-800">Trending hashtags</h2>
                    {latestByHashtag.length > 0 && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{latestByHashtag.length}</span>
                    )}
                    <span className="text-xs text-slate-400">— Auto-scraped via Apify</span>
                    <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${trendsOpen ? "rotate-180" : ""}`} />
                  </button>
                  <button
                    onClick={handleScrape}
                    disabled={scraping}
                    className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  >
                    {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {scraping ? "Scraping…" : "Run scrape"}
                  </button>
                </div>

                {trendsOpen && (
                  latestByHashtag.length === 0 ? (
                    <p className="text-sm text-slate-400 pl-6">
                      No trends available yet. Configure hashtags on each client and run a scrape.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {latestByHashtag.map((trend, i) => {
                        const samples = (trend.sample_posts || []).slice(0, 3);
                        return (
                          <div key={i} className="border border-slate-100 rounded-xl p-3 hover:border-violet-200 hover:bg-violet-50/30 transition-all bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-violet-400" />
                                <span className="text-sm font-semibold text-slate-800">{trend.hashtag}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">{trend.platform}</span>
                                {trend.trend_score > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full font-medium">
                                    {trend.trend_score.toLocaleString("fr-FR")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {trend.client_name && selectedClient === "all" && (
                              <p className="text-[10px] text-slate-400 mb-1.5">{trend.client_name}</p>
                            )}
                            {samples.length > 0 && (
                              <div className="space-y-1">
                                {samples.map((post, j) => (
                                  <div key={j} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                                    <span className="text-violet-300 shrink-0">▸</span>
                                    <span className="line-clamp-2">
                                      {post.caption ? post.caption.slice(0, 80) : `${(post.likes || 0).toLocaleString("fr-FR")} likes`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </section>
            );
          })()}
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
