import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { format, addMonths } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELDS = [
  { key: "key_events", label: "Key dates & events",        placeholder: "Product launches, holidays, special events…" },
  { key: "campaigns",  label: "Campaigns & promotions",    placeholder: "Active campaigns, ongoing promos…" },
  { key: "themes",     label: "Main themes / topics",      placeholder: "Topics to cover this month…" },
  { key: "products",   label: "Products / services to highlight", placeholder: "What to put forward…" },
  { key: "notes",      label: "Additional notes",          placeholder: "Constraints, tone, anything else…" },
];

export default function MonthlyBriefs() {
  const [currentMonth, setCurrentMonth] = useState(format(addMonths(new Date(), 1), "yyyy-MM"));
  const [filterClient, setFilterClient] = useState("all");
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // brief id pending deletion
  const queryClient = useQueryClient();

  const shiftMonth = (dir) => {
    const d = new Date(currentMonth + "-01");
    d.setMonth(d.getMonth() + dir);
    setCurrentMonth(format(d, "yyyy-MM"));
    setSelected(null);
  };

  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ["monthly_briefs", currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_briefs")
        .select("*")
        .eq("month", currentMonth)
        .order("client_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_active"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("company_name").eq("status", "Actif").order("company_name");
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("monthly_briefs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_briefs", currentMonth] });
      setSelected(null);
      setConfirmDelete(null);
    },
  });

  const filtered = filterClient === "all" ? briefs : briefs.filter(b => b.client_name === filterClient);
  const selectedBrief = selected ? briefs.find(b => b.id === selected) : null;
  const monthLabel = format(new Date(currentMonth + "-01"), "MMMM yyyy", { locale: enUS });

  return (
    <div>
      {/* Nav */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-700 w-36 text-center capitalize">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c.company_name} value={c.company_name}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">{filtered.length} brief{filtered.length !== 1 ? "s" : ""} submitted</span>
      </div>

      <div className="flex gap-4">
        {/* List */}
        <div className="flex-1 min-w-0 space-y-2">
          {isLoading && <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <Clock className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No briefs submitted for {monthLabel} yet.</p>
            </div>
          )}
          {filtered.map(brief => {
            const isSelected = selected === brief.id;
            const filledFields = FIELDS.filter(f => brief[f.key]?.trim()).length;
            const isPendingDelete = confirmDelete === brief.id;
            return (
              <div key={brief.id}
                onClick={() => !isPendingDelete && setSelected(isSelected ? null : brief.id)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${isSelected ? "border-[#2A69FF] ring-1 ring-[#2A69FF]/10" : "border-slate-100 hover:border-slate-200"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{brief.client_name}</p>
                    {brief.title?.trim() && (
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{brief.title}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {brief.submitted_at
                        ? `Submitted ${format(new Date(brief.submitted_at), "d MMM yyyy 'at' HH:mm", { locale: enUS })}`
                        : "Draft — not yet submitted"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-xs text-slate-400">{filledFields}/{FIELDS.length} fields</span>
                    {brief.submitted_at
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <Clock className="w-4 h-4 text-amber-400" />
                    }
                    {isPendingDelete ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => deleteMutation.mutate(brief.id)}
                          disabled={deleteMutation.isPending}
                          className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md border border-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(brief.id); }}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-red-400 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview of first filled field */}
                {!isSelected && (() => {
                  const first = FIELDS.find(f => brief[f.key]?.trim());
                  return first ? (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-slate-600">{first.label}: </span>{brief[first.key]}
                    </p>
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedBrief && (
          <div className="w-80 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 self-start sticky top-4">
            <div>
              <p className="text-base font-bold text-slate-800">{selectedBrief.client_name}</p>
              {selectedBrief.title?.trim() && (
                <p className="text-sm text-slate-600 font-medium mt-0.5">{selectedBrief.title}</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{monthLabel}</p>
              {selectedBrief.submitted_at && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Submitted
                </span>
              )}
            </div>
            <div className="space-y-3">
              {FIELDS.map(f => selectedBrief[f.key]?.trim() ? (
                <div key={f.key}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{f.label}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedBrief[f.key]}</p>
                </div>
              ) : null)}
              {FIELDS.every(f => !selectedBrief[f.key]?.trim()) && (
                <p className="text-sm text-slate-400 italic">No content filled yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
