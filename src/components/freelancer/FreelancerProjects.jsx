import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { format, isPast, differenceInHours } from "date-fns";
import {
  CheckCircle2, XCircle, Truck, MessageSquare, ChevronDown, ChevronUp,
  Clock, AlertTriangle, ExternalLink, FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_CONFIG = {
  "Unassigned":         { color: "bg-slate-100 text-slate-500" },
  "Pending acceptance": { color: "bg-amber-100 text-amber-700" },
  "Accepted":           { color: "bg-blue-100 text-blue-700" },
  "In progress":        { color: "bg-indigo-100 text-indigo-700" },
  "Delivered":          { color: "bg-violet-100 text-violet-700" },
  "Revision requested": { color: "bg-red-100 text-red-700" },
  "Completed":          { color: "bg-emerald-100 text-emerald-700" },
};

const TYPE_COLORS = {
  "Video":  "bg-pink-50 text-pink-700",
  "Photo":  "bg-blue-50 text-blue-700",
  "Design": "bg-violet-50 text-violet-700",
  "Copy":   "bg-amber-50 text-amber-700",
  "Other":  "bg-slate-100 text-slate-600",
};

function DeadlineBadge({ deadline, status }) {
  if (!deadline || status === "Completed") return null;
  const d = new Date(deadline);
  const hoursLeft = differenceInHours(d, new Date());
  if (isPast(d)) return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Overdue</span>;
  if (hoursLeft < 48) return <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {Math.round(hoursLeft)}h left</span>;
  return <span className="text-[10px] text-slate-400">{format(d, "d MMM yyyy")}</span>;
}

function ProjectCard({ project, onAction, freelancerName }) {
  const [expanded, setExpanded] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [clarifyMsg, setClarifyMsg] = useState("");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG["Unassigned"];
  const isPending = project.status === "Pending acceptance";
  const isActive = ["Accepted", "In progress", "Revision requested"].includes(project.status);

  const act = async (action, extra = {}) => {
    setLoading(true);
    await base44.functions.invoke('projectAction', {
      action,
      project_id: project.id,
      freelancer_name: freelancerName,
      ...extra,
    });
    onAction();
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isPending ? "border-amber-200" : "border-slate-100"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{project.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{project.client_name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{project.status}</span>
              {project.content_type && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[project.content_type] || TYPE_COLORS["Other"]}`}>{project.content_type}</span>}
              <DeadlineBadge deadline={project.deadline} status={project.status} />
            </div>
          </div>
          <button onClick={() => setExpanded(v => !v)} className="text-slate-300 hover:text-slate-500 transition-colors p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {isPending && (
            <>
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" disabled={loading} onClick={() => act('accept')}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={loading} onClick={() => setDeclineOpen(true)}>
                <XCircle className="w-3 h-3 mr-1" /> Decline
              </Button>
            </>
          )}
          {isActive && project.status !== "Delivered" && (
            <>
              <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700" disabled={loading} onClick={() => setDeliverOpen(true)}>
                <Truck className="w-3 h-3 mr-1" /> Mark as Delivered
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => setClarifyOpen(true)}>
                <MessageSquare className="w-3 h-3 mr-1" /> Ask question
              </Button>
            </>
          )}
          {project.status === "Revision requested" && (
            <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" disabled={loading} onClick={() => setDeliverOpen(true)}>
              <Truck className="w-3 h-3 mr-1" /> Re-deliver
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-2">
          {project.brief && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Brief</p>
              <p className="text-xs text-slate-600">{project.brief}</p>
            </div>
          )}
          {project.description && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-slate-600">{project.description}</p>
            </div>
          )}
          {project.notes && (
            <div className="bg-amber-50 rounded-lg p-2 text-xs text-amber-800">
              <strong>Admin note:</strong> {project.notes}
            </div>
          )}
          {project.clarification_request && (
            <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
              <strong>Your question:</strong> {project.clarification_request}
            </div>
          )}
          {project.delivery_url && (
            <div className="bg-violet-50 rounded-lg p-2 text-xs text-violet-700 flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">Delivery:</span>
              <a href={project.delivery_url} target="_blank" rel="noopener noreferrer" className="underline truncate hover:text-violet-900">{project.delivery_url}</a>
            </div>
          )}
        </div>
      )}

      {/* Deliver dialog */}
      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Deliver project</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Paste the link to your deliverable (Google Drive, Dropbox, etc.)</p>
          <input
            type="url"
            value={deliveryUrl}
            onChange={e => setDeliveryUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeliverOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" disabled={!deliveryUrl.trim() || loading} onClick={() => { act('deliver', { delivery_url: deliveryUrl }); setDeliverOpen(false); setDeliveryUrl(""); }}>
              <Truck className="w-3.5 h-3.5 mr-1.5" /> Deliver
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Decline project</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Optionally, leave a reason for declining.</p>
          <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="Reason (optional)..." />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => { act('decline', { reason: declineReason, freelancer_name: freelancerName }); setDeclineOpen(false); }}>
              Confirm decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clarify dialog */}
      <Dialog open={clarifyOpen} onOpenChange={setClarifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request clarification</DialogTitle></DialogHeader>
          <Textarea value={clarifyMsg} onChange={e => setClarifyMsg(e.target.value)} rows={3} placeholder="Your question..." />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setClarifyOpen(false)}>Cancel</Button>
            <Button className="bg-slate-800 hover:bg-slate-700" onClick={() => { act('clarify', { message: clarifyMsg }); setClarifyOpen(false); }}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FreelancerProjects({ projects, onRefresh, freelancerName }) {
  const pending = projects.filter(p => p.status === "Pending acceptance");
  const active = projects.filter(p => ["Accepted", "In progress", "Revision requested"].includes(p.status));
  const delivered = projects.filter(p => p.status === "Delivered");
  const done = projects.filter(p => p.status === "Completed");

  if (projects.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No projects assigned yet</p>
    </div>
  );

  const Section = ({ title, items, color }) => items.length === 0 ? null : (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color || "text-slate-400"}`}>{title} ({items.length})</p>
      <div className="space-y-3">{items.map(p => <ProjectCard key={p.id} project={p} onAction={onRefresh} freelancerName={freelancerName} />)}</div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Section title="Awaiting your response" items={pending} color="text-amber-600" />
      <Section title="In progress" items={active} color="text-blue-600" />
      <Section title="Delivered — awaiting review" items={delivered} color="text-violet-600" />
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 list-none py-2 select-none">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            Completed ({done.length})
          </summary>
          <div className="space-y-3 mt-2 opacity-70">
            {done.map(p => <ProjectCard key={p.id} project={p} onAction={onRefresh} freelancerName={freelancerName} />)}
          </div>
        </details>
      )}
    </div>
  );
}