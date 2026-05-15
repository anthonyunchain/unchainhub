import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList, Users, FileText, Lightbulb, BookOpen, BarChart2, Target,
  TrendingUp, Receipt, RefreshCw, Wrench, Wallet, FileCheck, Scale,
  LayoutTemplate, CalendarDays, PieChart, Building2, ShoppingBag,
  UserCog, Shield, MessageSquare, ExternalLink, ChevronDown, ChevronRight,
  GripVertical,
} from "lucide-react";
import { useState, useRef } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_SECTIONS = [
  { label: "Operations", items: [
    { id: 'tasks',     label: 'Admin Tasks',     icon: ClipboardList },
    { id: 'crm',       label: 'CRM',             icon: Users },
    { id: 'briefs',    label: 'Monthly Briefs',  icon: FileText },
    { id: 'ideas',     label: 'Ideas',           icon: Lightbulb },
    { id: 'tutorials', label: 'Tutorials',       icon: BookOpen },
    { id: 'analytics', label: 'Analytics',       icon: BarChart2 },
    { id: 'sales',     label: 'Prospects',       icon: Target },
  ]},
  { label: "Finance", items: [
    { id: 'finance',       label: 'Finance',       icon: TrendingUp },
    { id: 'expenses',      label: 'Expenses',      icon: Receipt },
    { id: 'invoices',      label: 'Invoices',      icon: FileText },
    { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw },
    { id: 'services',      label: 'Services',      icon: Wrench },
    { id: 'salaries',      label: 'Salaries',      icon: Wallet },
  ]},
  { label: "Legal", items: [
    { id: 'contracts',    label: 'Contracts',     icon: FileCheck },
    { id: 'legal',        label: 'Legal Docs',    icon: Scale },
    { id: 'templates',    label: 'Templates',     icon: LayoutTemplate },
    { id: 'meetings',     label: 'Board Meetings',icon: CalendarDays },
    { id: 'shareholders', label: 'Shareholders',  icon: PieChart },
  ]},
  { label: "Team", items: [
    { id: 'clients',             label: 'Clients',            icon: Building2 },
    { id: 'freelancers-page',    label: 'Freelancers',        icon: Users },
    { id: 'meetings-page',       label: 'Meetings',           icon: CalendarDays },
    { id: 'freelancer-meetings', label: 'Freelancer Meetings',icon: MessageSquare },
    { id: 'shop',                label: 'Freelancer Shop',    icon: ShoppingBag },
    { id: 'users',               label: 'Users',              icon: UserCog },
    { id: 'permissions',         label: 'Permissions',        icon: Shield },
  ]},
];

const ICON_MAP = {
  ClipboardList, Users, FileText, Lightbulb, BookOpen, BarChart2, Target,
  TrendingUp, Receipt, RefreshCw, Wrench, Wallet, FileCheck, Scale,
  LayoutTemplate, CalendarDays, PieChart, Building2, ShoppingBag,
  UserCog, Shield, MessageSquare,
};

function serializeSections(sections) {
  return sections.map(sec => ({
    label: sec.label,
    items: sec.items.map(item => ({
      ...item,
      icon: Object.entries(ICON_MAP).find(([, v]) => v === item.icon)?.[0] || 'FileText',
    })),
  }));
}

function deserializeSections(raw) {
  return raw.map(sec => ({
    ...sec,
    items: sec.items.map(item => ({ ...item, icon: ICON_MAP[item.icon] || FileText })),
  }));
}

function loadSections() {
  try {
    const saved = localStorage.getItem('adminNavOrder');
    if (saved) return deserializeSections(JSON.parse(saved));
  } catch {}
  return DEFAULT_SECTIONS;
}

function saveSections(sections) {
  try {
    localStorage.setItem('adminNavOrder', JSON.stringify(serializeSections(sections)));
  } catch {}
}

export const ADMIN_NAV_SECTIONS = DEFAULT_SECTIONS;

export default function AdminNavPanel({ section, onSelect, badges = {} }) {
  const navigate = useNavigate();
  const [sections, setSections] = useState(loadSections);
  const [collapsed, setCollapsed] = useState({});
  const [draggingSecLabel, setDraggingSecLabel] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);

  // Track which type of drag is active so we don't mix them
  const dragType = useRef(null); // 'section' | 'item'
  const dragSec = useRef(null);
  const dragItem = useRef(null);

  const allItems = sections.flatMap(s => s.items);

  const handleMobileChange = (val) => {
    const item = allItems.find(i => i.id === val);
    if (item?.href) navigate(item.href);
    else onSelect?.(val);
  };

  // ── Section drag (only from header) ────────────────────────────────────────
  const onSecDragStart = (e, label) => {
    dragType.current = 'section';
    dragSec.current = label;
    setDraggingSecLabel(label);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'section:' + label);
  };

  const onSecDragEnd = () => {
    dragType.current = null;
    dragSec.current = null;
    setDraggingSecLabel(null);
  };

  // Drop zone on the whole section block (accepts section drops only)
  const onSecBlockDragOver = (e) => {
    if (dragType.current !== 'section') return;
    e.preventDefault();
  };

  const onSecBlockDrop = (e, targetLabel) => {
    if (dragType.current !== 'section') return;
    e.preventDefault();
    const from = dragSec.current;
    if (!from || from === targetLabel) return;
    setSections(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(s => s.label === from);
      const toIdx = next.findIndex(s => s.label === targetLabel);
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      saveSections(next);
      return next;
    });
    dragSec.current = null;
    setDraggingSecLabel(null);
    dragType.current = null;
  };

  // ── Item drag ───────────────────────────────────────────────────────────────
  const onItemDragStart = (e, secLabel, itemId) => {
    dragType.current = 'item';
    dragItem.current = { secLabel, itemId };
    setDraggingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'item:' + itemId);
    e.stopPropagation();
  };

  const onItemDragEnd = () => {
    dragType.current = null;
    dragItem.current = null;
    setDraggingItemId(null);
  };

  const onItemDragOver = (e, secLabel, itemId) => {
    if (dragType.current !== 'item') return;
    e.preventDefault();
    e.stopPropagation();
  };

  const onItemDrop = (e, targetSecLabel, targetItemId) => {
    if (dragType.current !== 'item') return;
    e.preventDefault();
    e.stopPropagation();
    const from = dragItem.current;
    if (!from || from.itemId === targetItemId) return;
    setSections(prev => {
      const next = prev.map(s => ({ ...s, items: [...s.items] }));
      const fromSec = next.find(s => s.label === from.secLabel);
      const toSec = next.find(s => s.label === targetSecLabel);
      const fromIdx = fromSec.items.findIndex(i => i.id === from.itemId);
      const [removed] = fromSec.items.splice(fromIdx, 1);
      const toIdx = toSec.items.findIndex(i => i.id === targetItemId);
      toSec.items.splice(toIdx, 0, removed);
      saveSections(next);
      return next;
    });
    dragItem.current = null;
    setDraggingItemId(null);
    dragType.current = null;
  };

  return (
    <>
      {/* Mobile dropdown */}
      <div className="md:hidden mb-4">
        <Select value={section || ''} onValueChange={handleMobileChange}>
          <SelectTrigger className="w-full h-11 text-sm font-semibold bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map(sec => (
              <SelectGroup key={sec.label}>
                <SelectLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">{sec.label}</SelectLabel>
                {sec.items.map(item => (
                  <SelectItem key={item.id} value={item.id} className="text-sm py-2.5">{item.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop vertical sidebar */}
      <nav className="hidden md:flex flex-col w-52 shrink-0 gap-1" style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
        {sections.map(sec => {
          const isCollapsed = collapsed[sec.label];
          const isDraggingSec = draggingSecLabel === sec.label;

          return (
            <div
              key={sec.label}
              className="mb-1"
              onDragOver={onSecBlockDragOver}
              onDrop={e => onSecBlockDrop(e, sec.label)}
              style={{ opacity: isDraggingSec ? 0.35 : 1, transition: 'opacity 150ms' }}
            >
              {/* Section header — this is the draggable element for sections */}
              <div
                draggable
                onDragStart={e => onSecDragStart(e, sec.label)}
                onDragEnd={onSecDragEnd}
                className="flex items-center w-full px-2 py-1.5 mb-0.5 group/sec cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="w-3 h-3 text-slate-200 group-hover/sec:text-slate-400 transition-colors shrink-0 mr-1" />
                <button
                  onClick={() => setCollapsed(prev => ({ ...prev, [sec.label]: !prev[sec.label] }))}
                  onMouseDown={e => e.stopPropagation()}
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest group-hover/sec:text-slate-600 transition-colors truncate">
                    {sec.label}
                  </span>
                  {isCollapsed
                    ? <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                    : <ChevronDown className="w-3 h-3 text-slate-300 shrink-0" />
                  }
                </button>
              </div>

              {!isCollapsed && sec.items.map(item => {
                const Icon = item.icon;
                const isActive = section === item.id;
                const badge = badges[item.id];
                const isDraggingItem = draggingItemId === item.id;

                const cls = `flex items-center gap-2 w-full pl-2 pr-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 group/item ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`;

                const grip = (
                  <GripVertical
                    className={`w-3 h-3 shrink-0 transition-colors ${
                      isActive
                        ? 'text-white/30 group-hover/item:text-white/60'
                        : 'text-slate-200 group-hover/item:text-slate-400'
                    }`}
                  />
                );

                const itemWrapProps = {
                  draggable: true,
                  onDragStart: e => onItemDragStart(e, sec.label, item.id),
                  onDragOver: e => onItemDragOver(e, sec.label, item.id),
                  onDrop: e => onItemDrop(e, sec.label, item.id),
                  onDragEnd: onItemDragEnd,
                  style: { opacity: isDraggingItem ? 0.35 : 1, transition: 'opacity 150ms', cursor: 'grab' },
                };

                if (item.href) {
                  return (
                    <div key={item.id} {...itemWrapProps}>
                      <Link to={item.href} className={cls} style={{ textDecoration: 'none' }}>
                        {grip}
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 shrink-0" />
                      </Link>
                    </div>
                  );
                }

                return (
                  <div key={item.id} {...itemWrapProps}>
                    <button
                      onClick={() => onSelect?.(item.id)}
                      onMouseDown={e => e.stopPropagation()}
                      className={cls}
                    >
                      {grip}
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                          isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>{badge}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
    </>
  );
}
