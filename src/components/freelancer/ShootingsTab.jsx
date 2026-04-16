import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { format, isPast, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { Camera, MapPin, Clock, CheckCircle2, XCircle, Clapperboard, ChevronDown, Link2 } from "lucide-react";

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

export default function ShootingsTab({ freelancerId }) {
  const qc = useQueryClient();

  // Fetch assignments for this freelancer
  const { data: myAssignments = [] } = useQuery({
    queryKey: ["my-shooting-assignments", freelancerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_assignments")
        .select("*")
        .eq("freelancer_id", freelancerId);
      if (error) throw error;
      return data;
    },
    enabled: !!freelancerId,
  });

  const shootingIds = myAssignments.map(a => a.shooting_id);

  // Fetch the shootings
  const { data: shootings = [] } = useQuery({
    queryKey: ["my-shootings", shootingIds],
    queryFn: async () => {
      if (shootingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shootings")
        .select("*")
        .in("id", shootingIds)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: shootingIds.length > 0,
  });

  // Fetch all assignments for these shootings (to show full crew)
  const { data: allAssignments = [] } = useQuery({
    queryKey: ["shooting-all-assignments", shootingIds],
    queryFn: async () => {
      if (shootingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shooting_assignments")
        .select("*")
        .in("shooting_id", shootingIds);
      if (error) throw error;
      return data;
    },
    enabled: shootingIds.length > 0,
  });

  // Fetch linked content
  const { data: contentLinks = [] } = useQuery({
    queryKey: ["shooting-content-links", shootingIds],
    queryFn: async () => {
      if (shootingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shooting_content")
        .select("*")
        .in("shooting_id", shootingIds);
      if (error) throw error;
      return data;
    },
    enabled: shootingIds.length > 0,
  });

  const respondMut = useMutation({
    mutationFn: async ({ assignmentId, status }) => {
      const { error } = await supabase
        .from("shooting_assignments")
        .update({ status })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-shooting-assignments"] });
      qc.invalidateQueries({ queryKey: ["shooting-all-assignments"] });
    },
  });

  const enriched = shootings.map(s => ({
    ...s,
    myAssignment: myAssignments.find(a => a.shooting_id === s.id),
    crew: allAssignments.filter(a => a.shooting_id === s.id),
    contentCount: contentLinks.filter(c => c.shooting_id === s.id).length,
  }));

  const upcoming = enriched.filter(s => s.status !== "Completed" && s.status !== "Cancelled");
  const past = enriched.filter(s => s.status === "Completed" || s.status === "Cancelled");

  if (enriched.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No shootings assigned to you yet</p>
      </div>
    );
  }

  const ShootingCard = ({ s }) => {
    const cfg = STATUS_COLOR[s.status] || STATUS_COLOR.Planned;
    const myStatus = s.myAssignment?.status || "Pending";
    const isPending = myStatus === "Pending";

    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg}`}>{s.status}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ASSIGN_COLOR[myStatus]}`}>
                {myStatus === "Pending" ? "Action needed" : myStatus}
              </span>
              {s.client_name && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{s.client_name}</span>}
            </div>
            <p className="text-sm font-bold text-slate-800">{s.title}</p>
          </div>
        </div>

        {/* Details */}
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

        {/* Crew */}
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

        {/* Images */}
        {(s.images || []).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {s.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="" className="w-16 h-16 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
              </a>
            ))}
          </div>
        )}

        {s.contentCount > 0 && (
          <p className="text-[10px] text-slate-400 flex items-center gap-1"><Link2 className="w-3 h-3" />{s.contentCount} content{s.contentCount > 1 ? "s" : ""} linked</p>
        )}

        {/* Accept / Decline buttons */}
        {isPending && (
          <div className="flex gap-2 pt-1">
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
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcoming.map(s => <ShootingCard key={s.id} s={s} />)}
        </div>
      )}

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
    </div>
  );
}
