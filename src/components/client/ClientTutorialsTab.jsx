import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { GraduationCap, Play, ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import { getYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/youtube";

export default function ClientTutorialsTab({ tr }) {
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState(null); // tutorial row being played

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tutorials")
        .select("id, title, description, youtube_url, category, position, created_at")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load tutorials: " + error.message);
      setTutorials(data || []);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const s = new Set();
    tutorials.forEach(t => t.category && s.add(t.category));
    return Array.from(s).sort();
  }, [tutorials]);

  const filtered = tutorials.filter(t => {
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${t.title} ${t.description || ""} ${t.category || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const embed = playing ? getYouTubeEmbedUrl(playing.youtube_url) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input
            placeholder={tr?.searchTutorials || "Search tutorials…"}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-64"
          />
        </div>
        {categories.length > 0 && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-9 w-44 text-sm" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr?.allCategories || "All categories"}</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} tutorial{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 220 }} aria-hidden="true" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={tutorials.length === 0 ? (tr?.noTutorials || "No tutorials yet") : (tr?.noTutorialsFiltered || "No tutorials match your filters")}
          description={tutorials.length === 0 ? (tr?.noTutorialsDesc || "Unchain Studio will upload helpful walkthroughs here.") : undefined}
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Tutorials">
          {filtered.map(t => {
            const id = getYouTubeId(t.youtube_url);
            const thumb = getYouTubeThumbnail(t.youtube_url, "hqdefault");
            return (
              <li key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <button
                  type="button"
                  onClick={() => id ? setPlaying(t) : window.open(t.youtube_url, "_blank", "noopener,noreferrer")}
                  className="relative block aspect-video bg-slate-100 group"
                  aria-label={`Play ${t.title}`}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <GraduationCap className="w-8 h-8 text-slate-300" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110" style={{ background: 'var(--brand)', color: '#fff' }}>
                      <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </button>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 leading-snug">{t.title}</h3>
                    {t.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>{t.category}</span>}
                  </div>
                  {t.description && <p className="text-xs text-slate-500 mt-1.5 line-clamp-3">{t.description}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Player dialog */}
      <Dialog open={!!playing} onOpenChange={(o) => { if (!o) setPlaying(null); }}>
        <DialogContent className="w-[95vw] sm:w-[90vw] sm:max-w-5xl p-0 overflow-hidden !bottom-auto !left-1/2 !right-auto !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !rounded-2xl !max-h-[90dvh]">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 pr-6">
              <GraduationCap className="w-5 h-5 text-brand" aria-hidden="true" />
              <span className="truncate flex-1">{playing?.title}</span>
              {playing?.youtube_url && (
                <a
                  href={playing.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Open in YouTube
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {playing && embed ? (
            <div className="aspect-video bg-black">
              <iframe
                src={`${embed}?autoplay=1&rel=0`}
                title={playing.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : playing ? (
            <div className="p-6 text-sm text-slate-500">
              Can't embed this video. <a href={playing.youtube_url} target="_blank" rel="noopener noreferrer" className="text-brand underline inline-flex items-center gap-1">Open on YouTube <ExternalLink className="w-3.5 h-3.5" /></a>
            </div>
          ) : null}
          {playing?.description && (
            <div className="px-5 py-3 border-t border-slate-100 text-sm text-slate-600" style={{ whiteSpace: 'pre-wrap' }}>
              {playing.description}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
