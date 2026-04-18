import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Music, Plus, Trash2, ExternalLink, Play, Pause, Upload, Link as LinkIcon,
  Pencil, Clock, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import { useConfirm } from "@/lib/confirm";

const BUCKET = "music-library";
const MAX_BYTES = 50 * 1024 * 1024;

const MOODS = [
  "Chill", "Upbeat", "Cinematic", "Acoustic", "Electronic",
  "Hip-Hop", "Lofi", "Corporate", "Epic", "Romantic", "Funky", "Ambient",
];

const emptyForm = { id: null, title: "", artist: "", mood: "", bpm: "", duration_sec: "", url: "", file_path: "", notes: "" };

function fmtDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClientMusicTab({ clientId, clientName, canEdit = true }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMood, setFilterMood] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [playingPath, setPlayingPath] = useState(null); // path currently playing
  const [audioEl, setAudioEl] = useState(null);
  const [signedUrls, setSignedUrls] = useState({}); // path -> signed url

  const confirm = useConfirm();

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("client_music_tracks")
      .select("id, title, artist, mood, bpm, duration_sec, url, file_path, notes, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load music: " + error.message);
    setTracks(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  // Cleanup audio on unmount
  useEffect(() => () => { if (audioEl) { audioEl.pause(); } }, [audioEl]);

  const moods = useMemo(() => {
    const s = new Set();
    tracks.forEach(t => t.mood && s.add(t.mood));
    return ["all", ...Array.from(s).sort()];
  }, [tracks]);

  const filtered = tracks.filter(t => {
    if (filterMood !== "all" && t.mood !== filterMood) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${t.title} ${t.artist || ""} ${t.notes || ""} ${t.mood || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const openNew = () => { setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (t) => {
    setForm({
      id: t.id,
      title: t.title || "",
      artist: t.artist || "",
      mood: t.mood || "",
      bpm: t.bpm ?? "",
      duration_sec: t.duration_sec ?? "",
      url: t.url || "",
      file_path: t.file_path || "",
      notes: t.notes || "",
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error("File exceeds 50 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "mp3";
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `${clientId}/${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      setForm(f => ({
        ...f,
        file_path: path,
        title: f.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
      toast.success("File uploaded");
    } catch (err) {
      toast.error("Upload failed: " + (err?.message || err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeUploadedFile = async () => {
    if (form.file_path) {
      await supabase.storage.from(BUCKET).remove([form.file_path]);
    }
    setForm(f => ({ ...f, file_path: "" }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    if (!form.url.trim() && !form.file_path) {
      toast.error("Add a link or upload a file");
      return;
    }
    setSaving(true);
    const payload = {
      client_id: clientId,
      title: form.title.trim(),
      artist: form.artist.trim() || null,
      mood: form.mood || null,
      bpm: form.bpm === "" ? null : Number(form.bpm),
      duration_sec: form.duration_sec === "" ? null : Number(form.duration_sec),
      url: form.url.trim() || null,
      file_path: form.file_path || null,
      notes: form.notes.trim() || null,
    };
    const q = form.id
      ? supabase.from("client_music_tracks").update(payload).eq("id", form.id)
      : supabase.from("client_music_tracks").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Track updated" : "Track added");
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (t) => {
    const ok = await confirm({
      title: "Delete this track?",
      description: t.file_path ? "The uploaded file will also be removed." : undefined,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    if (t.file_path) {
      await supabase.storage.from(BUCKET).remove([t.file_path]);
    }
    const { error } = await supabase.from("client_music_tracks").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Track deleted");
    load();
  };

  const togglePlay = async (track) => {
    if (!track.file_path) return;

    // If this track is already playing, pause
    if (playingPath === track.file_path && audioEl) {
      audioEl.pause();
      setPlayingPath(null);
      return;
    }

    // Stop any current playback
    if (audioEl) { audioEl.pause(); }

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="text-label-mono" style={{ margin: 0 }}>Music library{clientName ? ` — ${clientName}` : ""}</span>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
            <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add track
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search title, artist, notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-64"
        />
        <Select value={filterMood} onValueChange={setFilterMood}>
          <SelectTrigger className="h-9 w-40 text-sm" aria-label="Filter by mood"><SelectValue /></SelectTrigger>
          <SelectContent>
            {moods.map(m => <SelectItem key={m} value={m}>{m === "all" ? "All moods" : m}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} track{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 68 }} aria-hidden="true" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Music}
          title={tracks.length === 0 ? "No tracks yet" : "No tracks match filters"}
          description={tracks.length === 0 && canEdit ? "Add a Spotify / YouTube / Dropbox link, or upload an MP3." : undefined}
          action={tracks.length === 0 && canEdit ? <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add first track</Button> : undefined}
        />
      ) : (
        <ul className="space-y-2" aria-label="Music tracks">
          {filtered.map(t => {
            const isPlayingThis = playingPath === t.file_path;
            return (
              <li key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 flex items-center gap-3">
                {/* Play / icon */}
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

                {/* Meta */}
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

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      aria-label={`Open link for ${t.title}`}
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </a>
                  )}
                  {canEdit && (
                    <>
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
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit / create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-brand" /> {form.id ? "Edit track" : "Add track"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label htmlFor="music-title">Title *</Label>
              <Input id="music-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="music-artist">Artist</Label>
                <Input id="music-artist" value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="music-mood">Mood</Label>
                <Select value={form.mood || "_none"} onValueChange={v => setForm(f => ({ ...f, mood: v === "_none" ? "" : v }))}>
                  <SelectTrigger id="music-mood" className="mt-1"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="music-bpm">BPM</Label>
                <Input id="music-bpm" type="number" min={0} value={form.bpm} onChange={e => setForm(f => ({ ...f, bpm: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="music-duration">Duration (seconds)</Label>
                <Input id="music-duration" type="number" min={0} value={form.duration_sec} onChange={e => setForm(f => ({ ...f, duration_sec: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="music-url">External link <span className="text-slate-400">(Spotify, YouTube, Dropbox…)</span></Label>
              <Input id="music-url" type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" className="mt-1" />
            </div>
            <div>
              <Label>Or upload an audio file</Label>
              {form.file_path ? (
                <div className="mt-1 flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                  <Music className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs truncate flex-1">{form.file_path.split("/").pop()}</span>
                  <button type="button" onClick={removeUploadedFile} className="text-slate-400 hover:text-red-500" aria-label="Remove uploaded file">
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className={`mt-1 cursor-pointer flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-4 py-5 transition ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  <Upload className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span className="text-xs text-slate-500">{uploading ? "Uploading…" : "Click to upload MP3 / WAV (max 50 MB)"}</span>
                  <input type="file" className="hidden" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" onChange={handleFileUpload} />
                </label>
              )}
            </div>
            <div>
              <Label htmlFor="music-notes">Notes</Label>
              <Textarea id="music-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Where to use it, allergens, licensing…" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                {saving ? "Saving…" : (form.id ? "Save" : "Add track")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
