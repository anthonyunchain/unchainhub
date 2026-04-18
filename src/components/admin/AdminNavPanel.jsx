import { Link, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ADMIN_NAV_SECTIONS = [
  { label: "Operations", items: [
    { id: 'tasks',     label: 'Admin Tasks' },
    { id: 'briefs',    label: 'Monthly Briefs' },
    { id: 'ideas',     label: 'Ideas' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'sales',     label: 'Prospects' },
  ]},
  { label: "Finance", items: [
    { id: 'finance',       label: 'Finance' },
    { id: 'expenses',      label: 'Expenses' },
    { id: 'invoices',      label: 'Invoices' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'services',      label: 'Services' },
    { id: 'salaries',      label: 'Salaries' },
  ]},
  { label: "Legal & Governance", items: [
    { id: 'contracts',    label: 'Contracts' },
    { id: 'legal',        label: 'Legal Docs' },
    { id: 'templates',    label: 'Templates' },
    { id: 'meetings',     label: 'Board Meetings' },
    { id: 'shareholders', label: 'Shareholders' },
  ]},
  { label: "Team", items: [
    { id: 'freelancer-meetings', label: 'Freelancer Meetings' },
    { id: 'shop',                label: 'Freelancer Shop', href: '/FreelancerShop' },
    { id: 'users',               label: 'Users' },
    { id: 'permissions',         label: 'Permissions' },
  ]},
];

// section: currently active section id (or null if on a sub-page like shop)
// onSelect: called with section id when a non-href item is clicked
// badges: optional { [id]: string|number }
export default function AdminNavPanel({ section, onSelect, badges = {} }) {
  const navigate = useNavigate();

  const allItems = ADMIN_NAV_SECTIONS.flatMap(s => s.items);

  const handleMobileChange = (val) => {
    const item = allItems.find(i => i.id === val);
    if (item?.href) { navigate(item.href); } else { onSelect?.(val); }
  };

  return (
    <>
      {/* Mobile dropdown */}
      <div className="md:hidden">
        <Select value={section || 'shop'} onValueChange={handleMobileChange}>
          <SelectTrigger className="w-full h-11 text-sm font-semibold bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADMIN_NAV_SECTIONS.map(sec => (
              <SelectGroup key={sec.label}>
                <SelectLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">{sec.label}</SelectLabel>
                {sec.items.map(item => (
                  <SelectItem key={item.id} value={item.id} className="text-sm py-2.5">
                    {item.label}{badges[item.id] ? ` · ${badges[item.id]}` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop horizontal grid */}
      <div className="hidden md:grid grid-cols-4 gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        {ADMIN_NAV_SECTIONS.map(sec => (
          <div key={sec.label}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-2">{sec.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {sec.items.map(item => {
                const isActive = section === item.id || (!section && item.href);
                const cls = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive ? 'bg-[#2A69FF] text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`;
                if (item.href) {
                  return (
                    <Link key={item.id} to={item.href} className={cls} style={{ textDecoration: 'none' }}>
                      {item.label}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </Link>
                  );
                }
                return (
                  <button key={item.id} onClick={() => onSelect?.(item.id)} className={cls}>
                    {item.label}
                    {badges[item.id] && (
                      <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full leading-none ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>{badges[item.id]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
