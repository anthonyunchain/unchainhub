import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChefHat, LogOut, Send, History, CheckCircle2, Clock, FileText, Image as ImageIcon } from "lucide-react";
import FileDropzone from "@/components/shared/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/shared/EmptyState";

const ACCEPT = "application/pdf,image/*";

const STATUS_META = {
  received:    { label: "Received",    color: 'var(--warning-text)',  bg: 'var(--warning-bg)', icon: Clock },
  transmitted: { label: "Transmitted", color: 'var(--brand)',          bg: 'var(--brand-muted)', icon: Send },
  published:   { label: "Published",   color: 'var(--success-text)',  bg: 'var(--success-bg)', icon: CheckCircle2 },
  archived:    { label: "Archived",    color: 'var(--muted)',          bg: 'var(--divider)',     icon: FileText },
};

export default function StaffPortal() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle]       = useState("");
  const [period, setPeriod]     = useState("");
  const [notes, setNotes]       = useState("");
  const [files, setFiles]       = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        setUser(authUser);

        const { data: clientRow } = await supabase
          .from("clients")
          .select("id, company_name")
          .eq("staff_user_id", authUser.id)
          .maybeSingle();

        setClient(clientRow || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSubmissions = async (clientId) => {
    if (!clientId) return;
    setLoadingList(true);
    const { data } = await supabase
      .from("menu_submissions")
      .select("id, title, period, notes, files, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setSubmissions(data || []);
    setLoadingList(false);
  };

  useEffect(() => {
    if (client?.id) loadSubmissions(client.id);
  }, [client?.id]);

  const pathPrefix = useMemo(() => client?.id || "unknown", [client?.id]);

  const canSubmit = !!title.trim() && !submitting && !!client?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submitMenu", {
        body: {
          title: title.trim(),
          period: period.trim() || null,
          notes: notes.trim() || null,
          files,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Menu submitted");
      setTitle(""); setPeriod(""); setNotes(""); setFiles([]);
      loadSubmissions(client.id);
    } catch (e) {
      toast.error("Submission failed: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => supabase.auth.signOut();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="Loading">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: 'var(--divider)', borderTopColor: 'var(--ink)' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-md w-full">
          <EmptyState
            icon={ChefHat}
            title="No restaurant linked"
            description="Your account isn't linked to a restaurant yet. Please contact Unchain Studio so we can set this up."
            action={<Button variant="outline" onClick={signOut}><LogOut className="w-4 h-4 mr-1.5" />Sign out</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label-mono">Staff portal</p>
            <h1 className="text-h1 truncate" style={{ marginTop: 2 }}>{client.company_name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="w-4 h-4 mr-1.5" />Sign out
          </Button>
        </div>

        {/* Submit form */}
        <section
          aria-labelledby="new-menu-heading"
          className="rounded-2xl p-5 sm:p-6"
          style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }} aria-hidden="true">
              <ChefHat className="w-4 h-4" />
            </div>
            <h2 id="new-menu-heading" className="text-h3" style={{ margin: 0 }}>Send a new menu</h2>
          </div>
          <p className="text-body-sm" style={{ marginBottom: 18 }}>
            Add your menu content below. You can attach PDFs or photos. We'll pick it up and pass it to the designer.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="menu-title">Title *</Label>
              <Input
                id="menu-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lunch menu — week 17"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="menu-period">Period <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
              <Input
                id="menu-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. April 21 – May 4"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="menu-notes">Menu text / notes <span style={{ color: 'var(--subtle)' }}>(optional)</span></Label>
              <Textarea
                id="menu-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type the dishes, prices, allergens, or any instruction for the designer…"
                rows={8}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Attachments <span style={{ color: 'var(--subtle)' }}>(PDF or photos)</span></Label>
              <div className="mt-1">
                <FileDropzone
                  files={files}
                  onChange={setFiles}
                  bucket="menu-submissions"
                  pathPrefix={pathPrefix}
                  accept={ACCEPT}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button type="submit" disabled={!canSubmit} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                <Send className="w-4 h-4 mr-1.5" />
                {submitting ? "Sending…" : "Send menu"}
              </Button>
            </div>
          </form>
        </section>

        {/* History */}
        <section aria-labelledby="history-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
            <h2 id="history-heading" className="text-label-mono" style={{ margin: 0 }}>Previous submissions</h2>
          </div>

          {loadingList ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 82 }} aria-hidden="true" />)}
            </div>
          ) : submissions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No submissions yet"
              description="Your first menu will show up here after you send it."
            />
          ) : (
            <ul className="space-y-2" aria-label="Your menu submissions">
              {submissions.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.received;
                const Icon = meta.icon;
                const fileCount = Array.isArray(s.files) ? s.files.length : 0;
                return (
                  <li
                    key={s.id}
                    className="rounded-2xl p-4"
                    style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-h3" style={{ margin: 0 }}>{s.title}</p>
                        <p className="text-body-sm" style={{ marginTop: 2 }}>
                          {format(new Date(s.created_at), "d MMM yyyy · HH:mm", { locale: enUS })}
                          {s.period ? ` · ${s.period}` : ""}
                        </p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        <Icon className="w-3 h-3" aria-hidden="true" />
                        {meta.label}
                      </span>
                    </div>
                    {(s.notes || fileCount > 0) && (
                      <div className="mt-2 text-body-sm space-y-1">
                        {s.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</p>}
                        {fileCount > 0 && (
                          <p className="inline-flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            {fileCount} file{fileCount > 1 ? "s" : ""} attached
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
