import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Heart, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";

const CLIENT_COLORS = [
  "bg-blue-50 text-blue-700",
  "bg-violet-50 text-violet-700",
  "bg-pink-50 text-pink-700",
  "bg-amber-50 text-amber-700",
  "bg-emerald-50 text-emerald-700",
  "bg-cyan-50 text-cyan-700",
];

function clientColor(name) {
  if (!name) return "bg-slate-100 text-slate-500";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % CLIENT_COLORS.length;
  return CLIENT_COLORS[h];
}

export default function Ideas({ currentUserId, currentUserName, isFreelancer = false }) {
  const [title, setTitle] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [showClient, setShowClient] = useState(false);
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
  });

  const activeClients = [...clients]
    .filter(c => c.status === "Actif")
    .sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = filterClient === "all"
    ? ideas
    : filterClient === "none"
      ? ideas.filter(i => !i.client_name)
      : ideas.filter(i => i.client_name === filterClient);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const submitIdea = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from("ideas").insert({
      title: title.trim(),
      client_name: selectedClient || null,
      likes: [],
      created_by_id: currentUserId || null,
      created_by_name: currentUserName || null,
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setTitle("");
    setSelectedClient("");
    setShowClient(false);
    qc.invalidateQueries({ queryKey: ["ideas"] });
  };

  const handleTitleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!title.trim()) return;
    if (!showClient) {
      setShowClient(true);
    } else {
      submitIdea();
    }
  };

  const handleLike = async (idea) => {
    if (!currentUserId) return;
    const likes = idea.likes || [];
    const already = likes.includes(currentUserId);
    const updated = already ? likes.filter(id => id !== currentUserId) : [...likes, currentUserId];
    await supabase.from("ideas").update({ likes: updated }).eq("id", idea.id);
    qc.invalidateQueries({ queryKey: ["ideas"] });
  };

  const handleDelete = async (id) => {
    await supabase.from("ideas").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["ideas"] });
  };

  return (
    <div className={isFreelancer ? "max-w-3xl mx-auto" : ""}>
      {!isFreelancer && (
        <PageHeader title="Ideas" subtitle={`${ideas.length} idea${ideas.length !== 1 ? "s" : ""}`} />
      )}

      {/* Quick add */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
        <div className="flex gap-2 items-center">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Drop an idea… Enter to expand, Enter again to save"
            className="flex-1 border-0 shadow-none text-sm focus-visible:ring-0 px-0 placeholder:text-slate-300"
          />
          {title.trim() && (
            <button
              type="button"
              onClick={submitIdea}
              disabled={saving}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-50"
              style={{ background: "var(--brand)" }}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {showClient && (
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
            <Select value={selectedClient || "none"} onValueChange={v => setSelectedClient(v === "none" ? "" : v)}>
              <SelectTrigger className="h-7 text-xs w-44 border-slate-100">
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {activeClients.map(c => (
                  <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button type="button" onClick={() => { setShowClient(false); setSelectedClient(""); }} className="text-slate-300 hover:text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}
      </div>

      {/* Filters */}
      {ideas.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterClient("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterClient === "all" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
          >
            All <span className="opacity-50 ml-1">{ideas.length}</span>
          </button>
          {activeClients.filter(c => ideas.some(i => i.client_name === c.company_name)).map(c => (
            <button
              key={c.id}
              onClick={() => setFilterClient(c.company_name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterClient === c.company_name ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              {c.company_name} <span className="opacity-50 ml-1">{ideas.filter(i => i.client_name === c.company_name).length}</span>
            </button>
          ))}
          {ideas.some(i => !i.client_name) && (
            <button
              onClick={() => setFilterClient("none")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterClient === "none" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              General <span className="opacity-50 ml-1">{ideas.filter(i => !i.client_name).length}</span>
            </button>
          )}
        </div>
      )}

      {/* Ideas grid */}
      {isLoading && <p className="text-sm text-slate-400 text-center py-10">Loading...</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-2xl mb-2">💡</p>
          <p className="text-slate-400 text-sm">No ideas yet — be the first to drop one!</p>
        </div>
      )}

      <div className="columns-1 sm:columns-2 gap-3 space-y-3">
        {filtered.map(idea => {
          const liked = currentUserId && (idea.likes || []).includes(currentUserId);
          const likeCount = (idea.likes || []).length;
          const canDelete = !isFreelancer || idea.created_by_id === currentUserId;

          return (
            <div key={idea.id} className="break-inside-avoid bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              {idea.client_name && (
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 ${clientColor(idea.client_name)}`}>
                  {idea.client_name}
                </span>
              )}
              <p className="text-sm font-medium text-slate-800 leading-snug">{idea.title}</p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLike(idea)}
                    className={`flex items-center gap-1 text-xs font-medium transition-all ${liked ? "text-pink-500" : "text-slate-300 hover:text-pink-400"}`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${liked ? "fill-pink-500" : ""}`} />
                    {likeCount > 0 && <span>{likeCount}</span>}
                  </button>
                  {idea.created_by_name && (
                    <span className="text-[10px] text-slate-300">{idea.created_by_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {idea.created_at && (
                    <span className="text-[10px] text-slate-300">
                      {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true, locale: enUS })}
                    </span>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(idea.id)}
                      className="text-slate-200 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
