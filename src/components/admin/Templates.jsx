import { useState } from "react";
import { FileText, Presentation, ExternalLink, Plus, Trash2, Pencil, X, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TYPE_META = {
  pdf:    { icon: FileText,     color: "bg-red-50 text-red-600",    badge: "PDF" },
  slides: { icon: Presentation, color: "bg-amber-50 text-amber-600", badge: "Slides" },
  email:  { icon: Mail,          color: "bg-violet-50 text-violet-600", badge: "Email" },
  doc:    { icon: FileText,     color: "bg-blue-50 text-blue-600",   badge: "Doc" },
  other:  { icon: ExternalLink, color: "bg-slate-50 text-slate-600", badge: "Link" },
};

const CATEGORIES = [
  { key: "contracts", label: "Contract Templates" },
  { key: "emails",    label: "Email Templates" },
  { key: "reports",   label: "Reports & Analytics" },
  { key: "sales",     label: "Sales & Presentations" },
];

const STORAGE_KEY = "admin_templates_v3";

function loadTemplates() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [
    { id: "1", name: "Proposal", description: "Client proposal template", type: "pdf", url: "", category: "contracts" },
    { id: "2", name: "Client Contract", description: "Standard client contract", type: "pdf", url: "", category: "contracts" },
    { id: "3", name: "Freelancer Contract", description: "Freelancer agreement template", type: "pdf", url: "", category: "contracts" },
    { id: "6", name: "Analytics Report", description: "Monthly analytics report template", type: "pdf", url: "", category: "reports" },
    { id: "4", name: "Unchain Studio Introduction", description: "Agency introduction deck", type: "pdf", url: "", category: "sales" },
    { id: "5", name: "Discovery Call", description: "Discovery call presentation", type: "slides", url: "", category: "sales" },
  ];
}

export default function Templates() {
  const [templates, setTemplates] = useState(loadTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const save = (next) => {
    setTemplates(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const openNew = () => {
    setEditData({ id: "", name: "", description: "", type: "pdf", url: "", category: "contracts" });
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditData({ ...t });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editData.name.trim()) return;
    if (editData.id) {
      save(templates.map(t => t.id === editData.id ? editData : t));
    } else {
      save([...templates, { ...editData, id: Date.now().toString() }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id) => {
    if (confirm("Remove this template?")) save(templates.filter(t => t.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Templates</h2>
          <p className="text-sm text-slate-400 mt-0.5">Quick access to standard documents and presentations.</p>
        </div>
        <Button onClick={openNew} className="bg-brand hover:bg-brand/90 text-brand-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> Add template
        </Button>
      </div>

      <div className="space-y-8">
        {CATEGORIES.map(cat => {
          const items = templates.filter(t => t.category === cat.key);
          return (
            <div key={cat.key}>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{cat.label}</h3>
              {items.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(t => {
                    const meta = TYPE_META[t.type] || TYPE_META.other;
                    const Icon = meta.icon;
                    const hasUrl = !!t.url;
                    return (
                      <div
                        key={t.id}
                        className="group relative bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all p-4"
                      >
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(t)} className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(t.id)} className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-800 truncate">{t.name}</h3>
                              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.badge}</span>
                            </div>
                            {t.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.description}</p>}
                          </div>
                        </div>
                        <div className="mt-3">
                          {hasUrl ? (
                            <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" /> Open {meta.badge.toLowerCase()}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300 italic">No link set — click edit to add one</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-300 italic">No templates in this category yet.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData?.id ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Name *</Label>
                <Input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Ex: Client Contract" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="Short description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={editData.category} onValueChange={v => setEditData({ ...editData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={editData.type} onValueChange={v => setEditData({ ...editData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slides">Google Slides</SelectItem>
                      <SelectItem value="doc">Document</SelectItem>
                      <SelectItem value="other">Other link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Link / URL</Label>
                <Input value={editData.url} onChange={e => setEditData({ ...editData, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={!editData.name.trim()} className="bg-brand hover:bg-brand/90 text-brand-foreground">Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
