import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckSquare, Square, Plus, AlertTriangle, ChevronRight } from "lucide-react";
import { isToday, isPast } from "date-fns";
import { Link } from "react-router-dom";
import TaskFormDialog from "./TaskFormDialog";

export default function TodayTasksWidget() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Task.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Task.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setDialogOpen(false); },
  });

  const todayTasks = tasks.filter((t) => {
    if (t.status === "Terminé") return false;
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return isToday(d) || isPast(d);
  });

  const toggle = (task) => {
    updateMut.mutate({ id: task.id, d: { ...task, status: task.status === "Terminé" ? "Non commencé" : "Terminé" } });
  };

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--card-radius)',
      boxShadow: 'var(--card-shadow)',
      padding: '24px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Today's tasks</p>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginTop: 2 }}>{todayTasks.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-muted)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--brand-soft)'}
          >
            <Plus style={{ width: 14, height: 14 }} />
          </button>
          <Link to="/Tasks" style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--divider)', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
            transition: 'all 150ms ease',
          }}>
            <ChevronRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {todayTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckSquare style={{ width: 32, height: 32, color: 'var(--divider)', margin: '0 auto 8px' }} />
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--subtle)' }}>All clear!</p>
          </div>
        ) : (
          todayTasks.slice(0, 8).map((task, i) => (
            <div
              key={task.id}
              className="flex items-center gap-3"
              style={{
                padding: '11px 8px',
                borderBottom: i < todayTasks.slice(0, 8).length - 1 ? '1px solid var(--divider)' : 'none',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(42,105,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <button
                onClick={() => toggle(task)}
                style={{
                  flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center',
                  color: task.status === "Terminé" ? 'var(--brand)' : 'var(--subtle)',
                  transition: 'color 150ms ease',
                }}
              >
                {task.status === "Terminé"
                  ? <CheckSquare style={{ width: 16, height: 16 }} />
                  : <Square style={{ width: 16, height: 16 }} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  color: task.status === "Terminé" ? 'var(--subtle)' : 'var(--ink)',
                  textDecoration: task.status === "Terminé" ? 'line-through' : 'none',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.status === "Bloqué" && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--urgent)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle style={{ width: 10, height: 10 }} /> Bloqué
                    </span>
                  )}
                  {task.client_name && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--subtle)' }}>{task.client_name}</span>}
                </div>
              </div>
              {isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', background: '#FEF0ED', color: '#C0391A', padding: '3px 8px', borderRadius: 100, flexShrink: 0 }}>Overdue</span>
              )}
            </div>
          ))
        )}
        {todayTasks.length > 8 && (
          <Link to="/Tasks" style={{ display: 'block', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--brand)', paddingTop: 12, textDecoration: 'none' }}>
            +{todayTasks.length - 8} more
          </Link>
        )}
      </div>

      <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} task={null} onSave={(d) => createMut.mutate(d)} />
    </div>
  );
}