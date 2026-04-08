import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clapperboard, ExternalLink, ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

const EDITING_STATUS_COLORS = {
  "Non assigné": "bg-slate-100 text-slate-500",
  "À faire": "bg-amber-100 text-amber-700",
  "En cours de montage": "bg-blue-100 text-blue-700",
  "En attente de retour": "bg-violet-100 text-violet-700",
  "Terminé": "bg-emerald-100 text-emerald-700"
};

export default function VideoEditing() {
  const [filterEditor, setFilterEditor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [expandedEditors, setExpandedEditors] = useState({});
  const [showDone, setShowDone] = useState(false);
  const qc = useQueryClient();

  const { data: content = [] } = useQuery({
    queryKey: ["editorial"],
    queryFn: () => base44.entities.EditorialContent.list()
  });
  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: () => base44.entities.Freelancer.list()
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.EditorialContent.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["editorial"] })
  });

  // Only show content with an assigned editor, hide "Terminé" unless toggled
  const assigned = content.filter((c) => c.assigned_editor_id && (showDone || c.editing_status !== "Terminé"));

  const filtered = assigned.filter((c) => {
    const editorMatch = filterEditor === "all" || c.assigned_editor_id === filterEditor;
    const statusMatch = filterStatus === "all" || c.editing_status === filterStatus;
    return editorMatch && statusMatch;
  });

  // Group by editor
  const grouped = filtered.reduce((acc, c) => {
    const key = c.assigned_editor_name || c.assigned_editor_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const toggleEditor = (name) => setExpandedEditors((e) => ({ ...e, [name]: !e[name] }));

  return (
    <div className="mx-auto" style={{ maxWidth: '1400px' }}>
      <PageHeader title="Video Editing" subtitle="Overview of video editing tasks">
        <Select value={filterEditor} onValueChange={setFilterEditor}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All editors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All editors</SelectItem>
            {freelancers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-52 h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="À faire">To do</SelectItem>
            <SelectItem value="En cours de montage">In progress</SelectItem>
            <SelectItem value="En attente de retour">Awaiting feedback</SelectItem>
            <SelectItem value="Terminé">Done</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className={`h-9 text-sm ${showDone ? "border-emerald-400 text-emerald-700 bg-emerald-50" : ""}`}
          onClick={() => setShowDone((v) => !v)}>
          
          {showDone ? "Hide completed" : "Show completed"}
        </Button>
      </PageHeader>

      {Object.keys(grouped).length === 0 ?
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Clapperboard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No editing tasks assigned</p>
          <p className="text-slate-300 text-xs mt-1">Assign an editor from the Editorial Calendar</p>
        </div> :

      <div className="space-y-6">
          {Object.entries(grouped).map(([editorName, tasks]) => {
          const isOpen = expandedEditors[editorName] !== false; // open by default
          return (
            <div key={editorName} className="bg-[hsl(var(--card))] rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
                onClick={() => toggleEditor(editorName)}>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2A69FF]/10 flex items-center justify-center text-[#2A69FF] font-semibold text-sm">
                    {editorName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800">{editorName}</p>
                    <p className="text-xs text-slate-400">{tasks.length} task{tasks.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {["À faire", "En cours de montage", "En attente de retour", "Terminé"].map((s) => {
                      const count = tasks.filter((t) => t.editing_status === s).length;
                      if (!count) return null;
                      const DISPLAY = { "À faire": "To do", "En cours de montage": "In progress", "En attente de retour": "Awaiting feedback", "Terminé": "Done" };
                      return <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${EDITING_STATUS_COLORS[s]}`}>{count} {DISPLAY[s]}</span>;
                    })}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {isOpen &&
              <div className="divide-y divide-slate-50">
                {tasks.map((task) =>
                <div key={task.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{task.title || "Untitled"}</p>
                          <span className="text-xs text-slate-400 shrink-0">{task.client_name}</span>
                          {task.scheduled_date &&
                        <span className="text-xs text-slate-400 shrink-0">
                              · {format(new Date(task.scheduled_date), "d MMM", { locale: enUS })}
                            </span>
                        }
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${EDITING_STATUS_COLORS[task.editing_status] || EDITING_STATUS_COLORS["Non assigné"]}`}>
                            {{"Non assigné": "Unassigned", "À faire": "To do", "En cours de montage": "In progress", "En attente de retour": "Awaiting feedback", "Terminé": "Done"}[task.editing_status] || task.editing_status || "Unassigned"}
                          </span>
                          {task.post_type && <span className="text-[10px] text-slate-400">{task.post_type}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                        value={task.editing_status || "Non assigné"}
                        onValueChange={(v) => updateMut.mutate({ id: task.id, d: { ...task, editing_status: v } })}>
                        
                          <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="À faire">To do</SelectItem>
                            <SelectItem value="En cours de montage">In progress</SelectItem>
                            <SelectItem value="En attente de retour">Awaiting feedback</SelectItem>
                            <SelectItem value="Terminé">Done</SelectItem>
                          </SelectContent>
                        </Select>
                        {(task.editing_instructions || task.editing_files?.length > 0) &&
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="text-slate-400 hover:text-slate-600">
                        
                            {expanded[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                      }
                      </div>
                    </div>

                    {expanded[task.id] &&
                  <div className="mt-3 pl-0 space-y-3">
                        {task.drive_link &&
                    <a
                      href={task.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                      
                            <FolderOpen className="w-3.5 h-3.5" /> Open Drive
                          </a>
                    }
                        {task.editing_instructions &&
                    <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-slate-500 mb-1">Instructions</p>
                            <p className="text-sm text-slate-700 whitespace-pre-line">{task.editing_instructions}</p>
                          </div>
                    }
                        {task.editing_files?.length > 0 &&
                    <div>
                            <p className="text-xs font-medium text-slate-500 mb-1.5">Reference files</p>
                            <div className="flex flex-wrap gap-2">
                              {task.editing_files.map((url, i) => {
                          const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A69FF]/10 text-[#2A69FF] rounded-lg text-xs hover:bg-[#2A69FF]/20 transition-colors">
                              
                                    <ExternalLink className="w-3 h-3" />
                                    {name.length > 30 ? name.slice(0, 30) + "…" : name}
                                  </a>);

                        })}
                            </div>
                          </div>
                    }
                      </div>
                  }
                  </div>
                )}
              </div>
              }
            </div>);
        })}
        </div>
      }
    </div>);

}