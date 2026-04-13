import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, X } from "lucide-react";

const EMPTY = {
  name: "",
  description: "",
  price: 0,
  price_type: "Mensuel",
  includes: [],
  active: true,
};

export default function Services() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [newInclude, setNewInclude] = useState("");
  const [mutError, setMutError] = useState(null);
  const qc = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { id, ...rest } = d;
      const { error } = await supabase.from("services").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); setOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { id: _id, created_at, ...rest } = d;
      const { error } = await supabase.from("services").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); setOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); setOpen(false); setMutError(null); },
    onError: (e) => setMutError(e.message),
  });

  const openNew = () => { setData({ ...EMPTY, includes: [] }); setMutError(null); setOpen(true); };
  const openEdit = (s) => { setData({ ...s, includes: s.includes || [] }); setMutError(null); setOpen(true); };
  const handleSave = () => data.id ? updateMut.mutate({ id: data.id, d: data }) : createMut.mutate(data);
  const handleDelete = () => { if (data?.id && confirm("Delete this service?")) { deleteMut.mutate(data.id); } };

  const addInclude = () => {
    if (newInclude.trim()) {
      setData(d => ({ ...d, includes: [...(d.includes || []), newInclude.trim()] }));
      setNewInclude("");
    }
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Services" subtitle="Service catalog">
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New Service
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.length === 0 && (
          <p className="text-slate-400 text-sm col-span-3 text-center py-10">No services yet</p>
        )}
        {services.map(s => (
          <div
            key={s.id}
            onClick={() => openEdit(s)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{s.name}</h3>
                {s.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{s.description}</p>}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${s.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {s.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">{(s.price || 0).toLocaleString("fr-FR")} €</span>
              <span className="text-xs text-slate-400">{s.price_type === "Mensuel" ? "/ month" : "one-time"}</span>
            </div>
            {s.includes?.length > 0 && (
              <div className="mt-3 space-y-1">
                {s.includes.map((item, i) => (
                  <p key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-brand shrink-0" />{item}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setMutError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{data?.id ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          {data && (
            <div className="space-y-4 mt-2">
              <div><Label>Name *</Label><Input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={data.description || ""} onChange={e => setData({ ...data, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Price (€)</Label><Input type="number" value={data.price || ""} onChange={e => setData({ ...data, price: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Type</Label>
                  <Select value={data.price_type} onValueChange={v => setData({ ...data, price_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensuel">Monthly</SelectItem>
                      <SelectItem value="Unique">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Status</Label>
                <Select value={String(data.active)} onValueChange={v => setData({ ...data, active: v === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Includes</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={newInclude} onChange={e => setNewInclude(e.target.value)} placeholder="Add item..." onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addInclude())} />
                  <Button type="button" variant="outline" size="sm" onClick={addInclude}>Add</Button>
                </div>
                <div className="mt-2 space-y-1">
                  {(data.includes || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-700">
                      {item}
                      <button onClick={() => setData(d => ({ ...d, includes: d.includes.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-400 ml-2">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {mutError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{mutError}</p>}

              <div className="flex justify-between items-center pt-2">
                {data.id ? <Button variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button> : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} className="bg-brand hover:bg-brand/90 text-brand-foreground"
                    disabled={!data.name || createMut.isPending || updateMut.isPending}>
                    {createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
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