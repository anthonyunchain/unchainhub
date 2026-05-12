import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { format, isPast, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { Camera, MapPin, Clock, CheckCircle2, XCircle, Clapperboard, ChevronDown, Link2, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUS_COLOR = {
  Planned:   "bg-blue-100 text-blue-700",
  Confirmed: "bg-emerald-100 text-emerald-700",
  Completed: "bg-slate-100 text-slate-500",
  Cancelled: "bg-red-100 text-red-700",
};

const ASSIGN_COLOR = {
  Pending:  "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Declined: "bg-red-100 text-red-600",
};

const STATUSES = ["Planned", "Confirmed", "Completed", "Cancelled"];

const emptyForm = {
  title: "", client_name: "", date: "", time: "", location: "",
  status: "Planned", description: "", gear: "", notes: "",
};

export default function ShootingsTab({ freelancerId }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch ALL shootings (RLS allows all freelancers to read)
  const { data: shootings = [] } = useQuery({
    queryKey: ["all-shootings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shootings")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all assignments
  const { data: allAssignments = [] } = useQuery({
    queryKey: ["all-shooting-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shooting_assignments").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch content links
  const { data: contentLinks = [] } = useQuery({
    queryKey: ["all-shooting-content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shooting_content").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch editorial content that needs a shooting (visible to this freelancer)
  const { data: editorial = [] } = useQuery({
    queryKey: ["editorial-needs-shooting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, client_name, post_type, scheduled_date, status")
        .neq("status", "Publié")
        .neq("needs_shooting", false);
      if (error) throw error;
      return data;
    },
  });

  // Respond to assignment mutation
  const respondMut = useMutation({
    mutationFn: async ({ assignmentId, status }) => {
      const { error } = await supabase
        .from("shooting_assignments")
        .update({ status })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-shooting-assignments"] }),
  });

  const openNew = () => { setForm({ ...emptyForm }); setEditId(null); setDialogOpen(true); };
  const openEdit = (s) => {
    setForm({
      title: s.title || "", client_name: s.client_name || "", date: s.date || "",
      time: s.time || "", location: s.location || "", status: s.status || "Planned",
      description: s.description || "", gear: s.gear || "", notes: s.notes || "",
    });
    setEditId(s.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        client_name: form.client_name || null,
        date: form.date || null,
        time: form.time || null,
        location: form.location || null,
        status: form.status,
        description: form.description || null,
        gear: form.gear || null,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("shootings").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shootings").insert(payload);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["all-shootings"] });
      setDialogOpen(false);
      toast.success(editId ? "Shooting updated" : "Shooting created");
    } catch (e) {
      toast.error("Error: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase.from("shootings").delete().eq("id", deleteConfirm);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["all-shootings"] });
      toast.success("Shooting deleted");
    } catch (e) { toast.error("Error: " + (e?.message || e)); }
    setDeleteConfirm(null);
  };

  // Enrich shootings
  const linkedContentIds = new Set(contentLinks.map(c => c.content_id));
  const enriched = shootings.map(s => ({
    ...s,
    myAssignment: allAssignments.find(a => a.shooting_id === s.id && a.freelancer_id === freelancerId),
    crew: allAssignments.filter(a => a.shooting_id === s.id),
    contentCount: contentLinks.filter(c => c.shooting_id === s.id).length,
  }));

  const upcoming = enriched.filter(s => s.status !== "Completed" && s.status !== "Cancelled");
  const past     = enriched.filter(s => s.status === "Completed" || s.status === "Cancelled");

  // Content needing a shooting (not linked yet)
  const contentNeedingShooting = editorial.filter(e => !linkedContentIds.has(e.id));

  // Unique clients from editorial for the form dropdown
  const clientOptions = [...new Set(editorial.map(e => e.client_name).filter(Boolean))].sort();

  const ShootingCard = ({ s }) => {
    const cfg = STATUS_COLOR[s.status] || STATUS_COLOR.Planned;
    const myStatus = s.myAssignment?.status;
    const isPending = myStatus === "Pending";

    return (
      <div
        className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3 cursor-pointer hover:border-slate-200 hover:shadow transition-all"
        onClick={() => openEdit(s)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg}`}>{s.status}</span>
              {myStatus && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ASSIGN_COLOR[myStatus]}`}>
                  {isPending ? "Action needed" : myStatus}
                </span>
              )}
              {s.client_name && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{s.client_name}</span>}
            </div>
            <p className="text-sm font-bold text-slate-800">{s.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {s.date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(parseISO(s.date), "EEEE d MMMM yyyy", { locale: enUS })}
              {s.time && ` · ${s.time}`}
            </span>
          )}
          {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
        </div>

        {s.description && <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>}

        {s.gear && (
          <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Clapperboard className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span><strong>Gear:</strong> {s.gear}</span>
          </div>
        )}

        {s.crew.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.crew.map(a => (
              <span key={a.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                a.freelancer_id === freelancerId ? "bg-brand/10 text-brand ring-1 ring-brand/20" : ASSIGN_COLOR[a.status] || "bg-slate-100 text-slate-500"
              }`}>
                {a.freelancer_name}{a.role ? ` · ${a.role}` : ""}
              </span>
            ))}
          </div>
        )}

        {s.contentCount > 0 && (
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Link2 className="w-3 h-3" />{s.contentCount} content{s.contentCount > 1 ? "s" : ""} linked
          </p>
        )}

        {isPending && (
          <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => respondMut.mutate({ assignmentId: s.myAssignment.id, status: "Accepted" })}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Accept
            </button>
            <button
              onClick={() => respondMut.mutate({ assignmentId: s.myAssignment.id, status: "Declined" })}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openNew} size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> New shooting
        </Button>
      </div>

      {/* Content needing a shooting */}
      {contentNeedingShooting.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4 text-amber-700" />
            <p className="text-sm font-semibold text-amber-800">{contentNeedingShooting.length} content{contentNeedingShooting.length > 1 ? "s" : ""} still need{contentNeedingShooting.length === 1 ? "s" : ""} a shooting</p>
          </div>
          <div className="space-y-1.5">
            {contentNeedingShooting.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="text-[10px] px-1.5 py-0.5 bg-white border border-amber-200 text-amber-700 rounded-full font-medium shrink-0">{c.post_type || "Content"}</span>
                <span className="font-medium text-slate-700 truncate">{c.title || "Untitled"}</span>
                {c.client_name && <span className="text-slate-400 shrink-0">{c.client_name}</span>}
                {c.scheduled_date && <span className="text-slate-400 shrink-0">{format(parseISO(c.scheduled_date), "d MMM", { locale: enUS })}</span>}
              </div>
            ))}
            {contentNeedingShooting.length > 8 && (
              <p className="text-[10px] text-amber-600 font-medium">+{contentNeedingShooting.length - 8} more</p>
            )}
          </div>
        </div>
      )}

      {/* Upcoming shootings */}
      {upcoming.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcoming.map(s => <ShootingCard key={s.id} s={s} />)}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No upcoming shootings</p>
          <button onClick={openNew} className="mt-2 text-xs text-brand underline">Create one</button>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 list-none py-2 select-none">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            Past ({past.length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 opacity-70">
            {past.map(s => <ShootingCard key={s.id} s={s} />)}
          </div>
        </details>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="!max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Shooting" : "New Shooting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Shooting name..." />
              </div>
              <div className="col-span-2">
                <Label>Client</Label>
                <Select value={form.client_name || "_none"} onValueChange={v => setForm(f => ({ ...f, client_name: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {clientOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Time</Label>
                <Input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="14:00" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Studio, address..." />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Gear required</Label>
                <Input value={form.gear} onChange={e => setForm(f => ({ ...f, gear: e.target.value }))} placeholder="Drone, flash, gimbal..." />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              {editId && (
                <button
                  onClick={() => { setDialogOpen(false); setDeleteConfirm(editId); }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              )}
              <div className={`flex gap-2 ${editId ? "" : "ml-auto"}`}>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleSave}
                  className="bg-brand hover:bg-brand/90 text-brand-foreground"
                  disabled={!form.title || saving}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (editId ? "Save" : "Create")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this shooting?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will also remove all crew assignments and content links.</p>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
