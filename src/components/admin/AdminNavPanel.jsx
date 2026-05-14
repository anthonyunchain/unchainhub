import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList, Users, FileText, Lightbulb, BookOpen, BarChart2, Target,
  TrendingUp, Receipt, RefreshCw, Wrench, Wallet, FileCheck, Scale,
  LayoutTemplate, CalendarDays, PieChart, Building2, ShoppingBag,
  UserCog, Shield, MessageSquare, ExternalLink, ChevronDown, ChevronRight
} from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ADMIN_NAV_SECTIONS = [
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
    { id: 'clients',             label: 'Clients',            icon: Building2,    href: '/Clients' },
    { id: 'freelancers-page',    label: 'Freelancers',        icon: Users,        href: '/FreelancerAdmin' },
    { id: 'meetings-page',       label: 'Meetings',           icon: CalendarDays, href: '/MeetingNotes' },
    { id: 'freelancer-meetings', label: 'Freelancer Meetings',icon: MessageSquare },
    { id: 'shop',                label: 'Freelancer Shop',    icon: ShoppingBag,  href: '/FreelancerShop' },
    { id: 'users',               label: 'Users',              icon: UserCog },
    { id: 'permissions',         label: 'Permissions',        icon: Shield },
  ]},
];

export default function AdminNavPanel({ section, onSelect, badges = {} }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState({});

  const allItems = ADMIN_NAV_SECTIONS.flatMap(s => s.items);

  const handleMobileChange = (val) => {
    const item = allItems.find(i => i.id === val);
    if (item?.href) navigate(item.href);
    else onSelect?.(val);
  };

  const toggleCollapse = (label) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
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
            {ADMIN_NAV_SECTIONS.map(sec => (
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
        {ADMIN_NAV_SECTIONS.map(sec => {
          const isCollapsed = collapsed[sec.label];
          return (
            <div key={sec.label} className="mb-1">
              <button
                onClick={() => toggleCollapse(sec.label)}
                className="flex items-center justify-between w-full px-2 py-1.5 mb-0.5 group"
              >
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                  {sec.label}
                </span>
                {isCollapsed
                  ? <ChevronRight className="w-3 h-3 text-slate-300" />
                  : <ChevronDown className="w-3 h-3 text-slate-300" />
                }
              </button>

              {!isCollapsed && sec.items.map(item => {
                const Icon = item.icon;
                const isActive = section === item.id;
                const badge = badges[item.id];
                const cls = `flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`;

                if (item.href) {
                  return (
                    <Link key={item.id} to={item.href} className={cls} style={{ textDecoration: 'none' }}>
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ExternalLink className="w-3 h-3 opacity-40 shrink-0" />
                    </Link>
                  );
                }

                return (
                  <button key={item.id} onClick={() => onSelect?.(item.id)} className={cls}>
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    {badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                        isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </>
  );
}
