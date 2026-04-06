import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import StatusBadge from "../components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Pencil, Check, X, Upload } from "lucide-react";
import CsvImportDialog from "../components/editorial/CsvImportDialog";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_COLORS = {
  Reel: "bg-pink-100 text-pink-700",
  Story: "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
};

export default function ContentDescriptions() {
  const [filterClient, setFilterClient] = useState("all");
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const qc = useQueryClient();

  const { data: content = [] } = useQuery({ queryKey: ["editorial"], queryFn: () => base44.entities.EditorialContent.list() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.filter({ status: "Actif" }) });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.EditorialContent.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["editorial"] }); setEditingId(null); },
  });

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditValue(c.description || "");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (c) => {
    updateMut.mutate({ id: c.id, d: { ...c, description: editValue } });
  };

  const currentMonth = format(new Date(), "yyyy-MM");
  const filtered = content
    .filter(c => c.scheduled_date?.startsWith(currentMonth))
    .filter(c => filterClient === "all" || c.client_name === filterClient)
    .filter(c => filterType === "all" || c.post_type === filterType)
    .sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Content Descriptions" subtitle={`${filtered.length} content${filtered.length > 1 ? 's' : ''}`}>
        <Link to="/Editorial">
          <Button variant="outline" className="h-9">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to calendar
          </Button>
        </Link>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
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

      <CsvImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">No content</div>
        )}
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.post_type] || "bg-slate-100 text-slate-600"}`}>{c.post_type}</span>
                  <span className="text-xs font-semibold text-slate-700">{c.client_name}</span>
                  {c.title && <span className="text-xs text-slate-500">— {c.title}</span>}
                  <StatusBadge status={c.status} />
                  {c.scheduled_date && (
                    <span className="text-xs text-slate-400">{format(new Date(c.scheduled_date), "d MMM yyyy", { locale: fr })}</span>
                  )}
                </div>

                {editingId === c.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={4}
                      className="text-sm"
                      placeholder="Content description..."
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
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                    {c.description || <span className="text-slate-300 italic">No description</span>}
                  </p>
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