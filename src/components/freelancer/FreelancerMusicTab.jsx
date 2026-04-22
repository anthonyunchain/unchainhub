import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { Music, Play, Pause, ExternalLink, Link as LinkIcon, Clock, Activity, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";

const BUCKET = "music-library";

function fmtDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Read-only music library for freelancers. Any freelancer can browse music for
 * any client — RLS allows SELECT to every freelancer.
 */
export default function FreelancerMusicTab() {
  const [tracks, setTracks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("all");
  const [filterMood, setFilterMood] = useState("all");
  const [search, setSearch] = useState("");
  const [playingPath, setPlayingPath] = useState(null);
  const [audioEl, setAudioEl] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [tracksRes, clientsRes] = await Promise.all([
        supabase.from("client_music_tracks")
          .select("id, client_id, title, artist, mood, bpm, duration_sec, url, file_path, notes, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, company_name"),
      ]);
      if (tracksRes.error) toast.error("Failed to load music: " + tracksRes.error.message);
      if (clientsRes.error && clientsRes.error.code !== "PGRST116") {
        // permission errors are expected silently; log others
        console.warn("clients read:", clientsRes.error.message);
      }
      setTracks(tracksRes.data || []);
      setClients(clientsRes.data || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => () => { if (audioEl) audioEl.pause(); }, [audioEl]);

  const clientById = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.id] = c.company_name; });
    return m;
  }, [clients]);

  const clientOptions = useMemo(() => {
    const ids = new Set(tracks.map(t => t.client_id));
    return Array.from(ids).map(id => ({ id, name: clientById[id] || "Client" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks, clientById]);

  const moodOptions = useMemo(() => {
    const s = new Set();
    tracks.forEach(t => t.mood && s.add(t.mood));
    return Array.from(s).sort();
  }, [tracks]);

  const filtered = tracks.filter(t => {
    if (filterClient !== "all" && t.client_id !== filterClient) return false;
    if (filterMood !== "all" && t.mood !== filterMood) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${t.title} ${t.artist || ""} ${t.notes || ""} ${t.mood || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const grouped = useMemo(() => {
    const m = new Map();
    filtered.forEach(t => {
      const key = t.client_id;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(t);
    });
    return Array.from(m.entries()).map(([cid, arr]) => ({
      clientId: cid,
      clientName: clientById[cid] || "Client",
      tracks: arr,
    })).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [filtered, clientById]);

  const togglePlay = async (track) => {
    if (!track.file_path) return;
    if (playingPath === track.file_path && audioEl) {
      audioEl.pause();
      setPlayingPath(null);
      return;
    }
    if (audioEl) audioEl.pause();
    let url = signedUrls[track.file_path];
    if (!url) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(track.file_path, 3600);
      if (error) { toast.error("Could not load audio: " + error.message); return; }
      url = data.signedUrl;
      setSignedUrls(m => ({ ...m, [track.file_path]: url }));
    }
    const a = new Audio(url);
    a.addEventListener("ended", () => setPlayingPath(null));
    a.play().catch(e => toast.error("Playback failed: " + e.message));
    setAudioEl(a);
    setPlayingPath(track.file_path);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 68 }} aria-hidden="true" />)}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <EmptyState
        icon={Music}
        title="No music yet"
        description="No music tracks have been added yet. Check back later."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input
            placeholder="Search title, artist, notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-64"
          />
        </div>
        {clientOptions.length > 1 && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-9 w-44 text-sm" aria-label="Filter by client"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clientOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {moodOptions.length > 0 && (
          <Select value={filterMood} onValueChange={setFilterMood}>
            <SelectTrigger className="h-9 w-40 text-sm" aria-label="Filter by mood"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All moods</SelectItem>
              {moodOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} track{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Music} title="No tracks match filters" />
      ) : grouped.map(g => (
        <section key={g.clientId} aria-labelledby={`music-client-${g.clientId}`} className="space-y-2">
          <h3 id={`music-client-${g.clientId}`} className="text-label-mono" style={{ margin: 0 }}>{g.clientName}</h3>
          <ul className="space-y-2">
            {g.tracks.map(t => {
              const isPlayingThis = playingPath === t.file_path;
              return (
                <li key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 flex items-center gap-3">
                  {t.file_path ? (
                    <button
                      type="button"
                      onClick={() => togglePlay(t)}
                      aria-label={isPlayingThis ? `Pause ${t.title}` : `Play ${t.title}`}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition"
                      style={{ background: isPlayingThis ? 'var(--brand)' : 'var(--brand-muted)', color: isPlayingThis ? '#fff' : 'var(--brand)' }}
                    >
                      {isPlayingThis ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />}
                    </button>
                  ) : t.url ? (
                    <a
                      href={t.url} target="_blank" rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition"
                      style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}
                      aria-label={`Open external link for ${t.title}`}
                    >
                      <LinkIcon className="w-4 h-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <div aria-hidden="true" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--divider)', color: 'var(--muted)' }}>
                      <Music className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      {t.artist && <span className="truncate">{t.artist}</span>}
                      {t.mood && <span className="inline-flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />{t.mood}</span>}
                      {t.bpm && <span className="inline-flex items-center gap-1"><Activity className="w-3 h-3" aria-hidden="true" />{t.bpm} BPM</span>}
                      {t.duration_sec ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden="true" />{fmtDuration(t.duration_sec)}</span> : null}
                    </div>
                    {t.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.notes}</p>}
                  </div>

                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                      aria-label={`Open link for ${t.title}`}
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
