import { useState } from "react";
import { supabase } from "@/api/base44Client";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_COLORS = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

export default function CaptionsTab({ items = [] }) {
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [localItems, setLocalItems] = useState(items);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpand = (id) => setExpandedIds(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const clients = [...new Set(items.map(i => i.client_name).filter(Boolean))];

  const currentMonth = format(new Date(), "yyyy-MM");
  const filtered = localItems
    .filter(c => c.scheduled_date?.startsWith(currentMonth))
    .filter(c => filterClient === "all" || c.client_name === filterClient)
    .filter(c => filterType === "all" || c.post_type === filterType)
    .sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));

  const startEdit = (c) => { setEditingId(c.id); setEditValue(c.description || ""); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (c) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('updateContentDescription', {
        body: { content_id: c.id, description: editValue },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setLocalItems(prev => prev.map(i => i.id === c.id ? { ...i, description: editValue } : i));
      setEditingId(null);
    } catch (e) {
      alert("Error saving: " + (e?.message || e));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Reel">Reel</SelectItem>
            <SelectItem value="Story">Story</SelectItem>
            <SelectItem value="Carousel">Carousel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
            No content this month
          </div>
        )}
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                  <span className="text-xs font-semibold text-slate-700">{c.client_name}</span>
                  {c.title && <span className="text-xs text-slate-500">— {c.title}</span>}
                  {c.scheduled_date && (
                    <span className="text-xs text-slate-400">{format(new Date(c.scheduled_date), "d MMM yyyy", { locale: enUS })}</span>
                  )}
                </div>

                {editingId === c.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={4}
                      className="text-sm"
                      placeholder="Write the caption..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => saveEdit(c)}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={cancelEdit}>
                        <X className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    {c.description ? (
                      <>
                        <p className={`text-sm text-slate-600 whitespace-pre-wrap ${expandedIds.has(c.id) ? '' : 'line-clamp-3'}`}>
                          {c.description}
                        </p>
                        <button onClick={() => toggleExpand(c.id)} className="text-xs text-slate-400 hover:text-slate-600 mt-1">
                          {expandedIds.has(c.id) ? '↑ Show less' : '↓ Show more'}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-300 italic text-sm">No caption yet</span>
                    )}
                  </div>
                )}
              </div>

              {editingId !== c.id && (
                <button onClick={() => startEdit(c)} className="text-slate-300 hover:text-[#2A69FF] shrink-0 mt-0.5">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
