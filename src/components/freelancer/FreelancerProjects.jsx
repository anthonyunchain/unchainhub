import { useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { format, isPast, differenceInHours, differenceInDays } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  CheckCircle2, XCircle, Truck, MessageSquare, ChevronDown,
  Clock, AlertTriangle, FolderOpen, MoreHorizontal, ExternalLink, Clapperboard,
  Download, Paperclip
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FileDropzone from "@/components/shared/FileDropzone";
import { openDeliverable, formatBytes } from "@/lib/deliverables";

// Pipeline stages in order
const STAGES = [
  { key: "Pending acceptance", label: "New" },
  { key: "Accepted",           label: "Accepted" },
  { key: "In progress",        label: "In progress" },
  { key: "Delivered",          label: "Delivered" },
  { key: "Completed",          label: "Done" },
];
// Revision requested sits between In progress and Delivered
const STAGE_INDEX = {
  "Pending acceptance": 0,
  "Accepted":           1,
  "In progress":        2,
  "Revision requested": 2,
  "Delivered":          3,
  "Completed":          4,
};

function PipelineBar({ status }) {
  const current = STAGE_INDEX[status] ?? 0;
  const isRevision = status === "Revision requested";
  return (
    <div className="flex items-center gap-0 w-full mb-4">
      {STAGES.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === STAGES.length - 1;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-full h-1 rounded-full transition-all ${
                done ? "bg-[#2A69FF]" :
                active && isRevision ? "bg-orange-400" :
                active ? "bg-[#2A69FF]" :
                "bg-slate-100"
              }`} />
              <span className={`text-[9px] mt-1 font-medium whitespace-nowrap transition-all ${
                active ? (isRevision ? "text-orange-500" : "text-[#2A69FF]") :
                done ? "text-slate-400" : "text-slate-200"
              }`}>
                {active && isRevision ? "Revision" : stage.label}
              </span>
            </div>
            {!isLast && <div className="w-2 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function DeadlineChip({ deadline, status }) {
  if (!deadline || status === "Completed") return null;
  const d = new Date(deadline);
  const hoursLeft = differenceInHours(d, new Date());
  const daysLeft = differenceInDays(d, new Date());
  if (isPast(d)) return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" /> Overdue
    </span>
  );
  if (hoursLeft < 24) return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> {Math.round(hoursLeft)}h left
    </span>
  );
  if (daysLeft <= 3) return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> {daysLeft}d left
    </span>
  );
  return (
    <span className="text-[11px] text-slate-400">{format(d, "d MMM yyyy", { locale: enUS })}</span>
  );
}

function ProjectCard({ project, onAction, freelancerName }) {
  const [declineOpen, setDeclineOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [clarifyMsg, setClarifyMsg] = useState("");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const existingFiles = Array.isArray(project.delivery_files) ? project.delivery_files : [];
  const revisionHistory = Array.isArray(project.revision_requests) ? project.revision_requests : [];

  const isPending = project.status === "Pending acceptance";
  const isActive = ["Accepted", "In progress"].includes(project.status);
  const isRevision = project.status === "Revision requested";
  const isDelivered = project.status === "Delivered";
  const isDone = project.status === "Completed";

  const act = async (action, extra = {}) => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('projectAction', {
        action, project_id: project.id, freelancer_name: freelancerName, ...extra,
      });
      if (data?.error) {
        alert('Error: ' + data.error);
      } else {
        onAction();
      }
    } catch (e) {
      console.error('projectAction error:', e);
      alert('Error: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Border accent based on urgency
  const borderClass = isPending
    ? "border-l-4 border-l-amber-400 border border-amber-100"
    : isRevision
    ? "border-l-4 border-l-orange-400 border border-orange-100"
    : isPast(project.deadline ? new Date(project.deadline) : new Date(9999,0)) && !isDone
    ? "border-l-4 border-l-red-400 border border-red-100"
    : "border border-slate-100";

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-visible transition-all ${borderClass}`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {isPending && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Action needed</span>}
              {isRevision && <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Revision requested</span>}
            </div>
            <p className="text-base font-bold text-slate-800 leading-tight">{project.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{project.client_name}{project.content_type ? ` · ${project.content_type}` : ""}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DeadlineChip deadline={project.deadline} status={project.status} />
            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[160px] py-1" onMouseLeave={() => setMenuOpen(false)}>
                  {(isActive || isRevision) && (
                    <button onClick={() => { setMenuOpen(false); setClarifyOpen(true); }} className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" /> Ask a question
                    </button>
                  )}
                  {isPending && (
                    <button onClick={() => { setMenuOpen(false); setDeclineOpen(true); }} className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                      <XCircle className="w-3.5 h-3.5" /> Decline
                    </button>
                  )}
                  {project.delivery_url && (
                    <a href={project.delivery_url} target="_blank" rel="noopener noreferrer" className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5" /> View delivery
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <PipelineBar status={project.status} />

        {/* Brief / notes — always visible */}
        {(project.brief || project.description) && (
          <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-3">
            {project.brief || project.description}
          </p>
        )}
        {project.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3">
            <span className="font-semibold">Admin note: </span>{project.notes}
          </div>
        )}
        {isRevision && project.notes && (
          <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-800 mb-3">
            <span className="font-semibold">Revision request: </span>{project.notes}
          </div>
        )}

        {/* Revision history with files/links */}
        {revisionHistory.length > 0 && (
          <div className="space-y-2 mb-3">
            {revisionHistory.map((rev, i) => (
              <div key={rev.id || i} className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-orange-800">Revision #{i + 1}{rev.by_admin_name ? ` · ${rev.by_admin_name}` : ""}</span>
                  {rev.created_at && (
                    <span className="text-[10px] text-orange-500">{format(new Date(rev.created_at), "d MMM HH:mm")}</span>
                  )}
                </div>
                {rev.message && <p className="text-orange-800 whitespace-pre-wrap">{rev.message}</p>}
                {Array.isArray(rev.files) && rev.files.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {rev.files.map(f => (
                      <button key={f.path} type="button" onClick={() => openDeliverable(f.path)}
                        className="flex items-center gap-1 bg-white border border-orange-200 rounded-md px-2 py-0.5 text-[11px] hover:bg-orange-100">
                        <Paperclip className="w-3 h-3 text-orange-600" />
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        {f.size ? <span className="text-orange-400">{formatBytes(f.size)}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
                {rev.link && (
                  <a href={rev.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-orange-700 underline mt-1">
                    <ExternalLink className="w-3 h-3" /> External link
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Delivered files */}
        {existingFiles.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Delivered files</p>
            <div className="flex flex-wrap gap-1.5">
              {existingFiles.map(f => (
                <button key={f.path} type="button" onClick={() => openDeliverable(f.path)}
                  className="flex items-center gap-1 bg-violet-50 border border-violet-100 rounded-md px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-100">
                  <Download className="w-3 h-3" />
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  {f.size ? <span className="text-violet-400">{formatBytes(f.size)}</span> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Project URL */}
        {project.url && (
          <a href={project.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-brand hover:underline mb-3">
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{project.url}</span>
          </a>
        )}

        {/* Project images */}
        {Array.isArray(project.images) && project.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {project.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="" className="w-20 h-20 rounded-lg border border-slate-200 object-cover hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        )}

        {/* Primary CTA */}
        <div className="flex items-center gap-2 mt-2">
          {isPending && (
            <Button
              className="flex-1 bg-[#2A69FF] hover:bg-[#2A69FF]/90 text-white h-9 text-sm font-semibold rounded-xl"
              disabled={loading}
              onClick={() => act('accept')}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Accept project
            </Button>
          )}
          {(isActive || isRevision) && (
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white h-9 text-sm font-semibold rounded-xl"
              disabled={loading}
              onClick={() => setDeliverOpen(true)}
            >
              <Truck className="w-4 h-4 mr-1.5" /> {isRevision ? "Re-deliver" : "Mark as delivered"}
            </Button>
          )}
          {isDelivered && (
            <div className="flex-1 flex items-center gap-2 text-xs text-violet-600 bg-violet-50 rounded-xl px-3 h-9">
              <Truck className="w-3.5 h-3.5 shrink-0" />
              Delivered — waiting for review
            </div>
          )}
          {isDone && (
            <div className="flex-1 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 h-9">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Completed
            </div>
          )}
        </div>
      </div>

      {/* Deliver dialog */}
      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isRevision ? "Re-deliver project" : "Deliver project"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Upload files</label>
              <FileDropzone
                files={deliveryFiles}
                onChange={setDeliveryFiles}
                pathPrefix={`projects/${project.id}/delivery`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Or paste a link (Drive, Dropbox, WeTransfer…)</label>
              <input
                type="url" value={deliveryUrl} onChange={e => setDeliveryUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
            </div>
            <p className="text-[11px] text-slate-400">Provide at least one: a file upload or a link.</p>
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={() => setDeliverOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700"
              disabled={loading || (!deliveryUrl.trim() && deliveryFiles.length === 0)}
              onClick={() => {
                act('deliver', { delivery_url: deliveryUrl, files: deliveryFiles });
                setDeliverOpen(false); setDeliveryUrl(""); setDeliveryFiles([]);
              }}>
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
            <Button className="bg-red-600 hover:bg-red-700"
              onClick={() => { act('decline', { reason: declineReason }); setDeclineOpen(false); }}>
              Confirm decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clarify dialog */}
      <Dialog open={clarifyOpen} onOpenChange={setClarifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ask a question</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Your message will be visible to the admin on the project.</p>
          <Textarea value={clarifyMsg} onChange={e => setClarifyMsg(e.target.value)} rows={3} placeholder="Your question..." />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setClarifyOpen(false)}>Cancel</Button>
            <Button className="bg-slate-800 hover:bg-slate-700"
              onClick={() => { act('clarify', { message: clarifyMsg }); setClarifyOpen(false); }}>
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sort by urgency: pending → revision → overdue → due soon → in progress → delivered → done
function urgencyScore(p) {
  if (p.status === "Pending acceptance") return 0;
  if (p.status === "Revision requested") return 1;
  if (p.deadline && isPast(new Date(p.deadline)) && p.status !== "Completed") return 2;
  if (p.deadline && differenceInHours(new Date(p.deadline), new Date()) < 48) return 3;
  if (["Accepted", "In progress"].includes(p.status)) return 4;
  if (p.status === "Delivered") return 5;
  return 6;
}

const EDITING_STATUS_LABEL = {
  "Non assigné": "Unassigned",
  "En attente d'acceptation": "Pending acceptance",
  "À faire": "To do",
  "En cours de montage": "In progress",
  "En attente de retour": "Awaiting feedback",
  "Terminé": "Done",
};

const EDITING_STATUS_COLOR = {
  "Non assigné":               "bg-slate-100 text-slate-500",
  "En attente d'acceptation":  "bg-amber-100 text-amber-700",
  "À faire":                   "bg-blue-100 text-blue-700",
  "En cours de montage":       "bg-indigo-100 text-indigo-700",
  "En attente de retour":      "bg-violet-100 text-violet-700",
  "Terminé":                   "bg-emerald-100 text-emerald-700",
};

function EditorialCard({ item }) {
  const isDone = item.editing_status === "Terminé";
  const statusLabel = EDITING_STATUS_LABEL[item.editing_status] || item.editing_status || "—";
  const statusColor = EDITING_STATUS_COLOR[item.editing_status] || "bg-slate-100 text-slate-500";
  const date = item.scheduled_date ? format(new Date(item.scheduled_date), "d MMM yyyy", { locale: enUS }) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Clapperboard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Video editing</span>
          </div>
          <p className="text-base font-bold text-slate-800 leading-tight">{item.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{item.client_name}{item.post_type ? ` · ${item.post_type}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {date && <span className="text-[11px] text-slate-400">{date}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
        {item.editing_instructions && (
          <p className="text-xs text-slate-400 truncate max-w-[200px]">{item.editing_instructions}</p>
        )}
      </div>
      {item.editing_files?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.editing_files.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-[#2A69FF] bg-blue-50 px-2 py-1 rounded-lg hover:underline">
              <ExternalLink className="w-3 h-3" /> Reference file {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FreelancerProjects({ projects, editorialItems = [], onRefresh, freelancerName }) {
  const [showDone, setShowDone] = useState(false);

  const activeEditorial = editorialItems.filter(p => p.editing_status !== "Terminé");
  const doneEditorial = editorialItems.filter(p => p.editing_status === "Terminé");

  if (projects.length === 0 && editorialItems.length === 0) return (
    <div className="text-center py-20 text-slate-400">
      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-medium">No projects assigned yet</p>
    </div>
  );

  const active = projects.filter(p => p.status !== "Completed").sort((a, b) => urgencyScore(a) - urgencyScore(b));
  const done = projects.filter(p => p.status === "Completed");

  return (
    <div className="space-y-3">
      {activeEditorial.map(p => (
        <EditorialCard key={p.id} item={p} />
      ))}

      {active.map(p => (
        <ProjectCard key={p.id} project={p} onAction={onRefresh} freelancerName={freelancerName} />
      ))}

      {(done.length > 0 || doneEditorial.length > 0) && (
        <div>
          <button
            onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium uppercase tracking-wider py-2 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDone ? "rotate-180" : ""}`} />
            Completed ({done.length + doneEditorial.length})
          </button>
          {showDone && (
            <div className="space-y-3 mt-1 opacity-60">
              {doneEditorial.map(p => <EditorialCard key={p.id} item={p} />)}
              {done.map(p => <ProjectCard key={p.id} project={p} onAction={onRefresh} freelancerName={freelancerName} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
