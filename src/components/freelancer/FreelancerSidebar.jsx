import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  LayoutDashboard, ClipboardList, FolderOpen, Wrench, CalendarDays,
  FileText, FileCheck, User, ChevronLeft, ChevronRight, Settings2,
  Check, GripVertical, LogOut, Bell, Briefcase
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_NAV = [
  { id: "dashboard",     label: "Dashboard",         icon: "LayoutDashboard" },
  { id: "notifications", label: "Notifications",     icon: "Bell" },
  { id: "myprojects",    label: "My Projects",       icon: "Briefcase" },
  { id: "tasks",         label: "Tasks",             icon: "ClipboardList" },
  { id: "projects",      label: "Editorial",         icon: "FolderOpen" },
  { id: "tools",         label: "Tools",             icon: "Wrench" },
  { id: "meetings",      label: "Meetings",          icon: "CalendarDays" },
  { id: "invoices",      label: "Admin",             icon: "FileText" },
  { id: "profile",       label: "Profile",           icon: "User" },
];

const ICON_MAP = {
  LayoutDashboard, ClipboardList, FolderOpen, Wrench, CalendarDays,
  FileText, FileCheck, User, Bell, Briefcase,
};

const STORAGE_KEY = "freelancer_sidebar_order_v2";

function loadOrder() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const ids = parsed.map(i => i.id);
      const missing = DEFAULT_NAV.filter(i => !ids.includes(i.id));
      return [...parsed, ...missing];
    }
  } catch {}
  return DEFAULT_NAV;
}

export default function FreelancerSidebar({ activeTab, onTabChange, user, freelancerProfile, unreadCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [navItems, setNavItems] = useState(loadOrder);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(navItems));
  }, [navItems]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(navItems);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setNavItems(items);
  };

  const resetOrder = () => {
    setNavItems(DEFAULT_NAV);
    localStorage.removeItem(STORAGE_KEY);
  };

  const HIDDEN_NAV_BY_ID = {
    'a83475b8-6afe-45c8-bbfb-7afcbbabfe54': ['projects', 'tools', 'meetings'], // Domnin
    '2ba918c3-a88e-4b9f-a570-68d8e6b0c1ed': ['tools'],
  };
  const hiddenNavItems = freelancerProfile?.hidden_nav_items?.length
    ? freelancerProfile.hidden_nav_items
    : HIDDEN_NAV_BY_ID[freelancerProfile?.id] || [];
  const visibleNavItems = navItems.filter(item => !hiddenNavItems.includes(item.id));

  const displayName = freelancerProfile?.name || user?.full_name || user?.email || "";
  const initials = displayName?.charAt(0)?.toUpperCase() || "?";
  const isAvailable = freelancerProfile?.status === "Actif";

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-slate-950 text-white flex flex-col z-50 transition-all duration-300",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo + user */}
      <div className="px-4 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center font-bold text-sm text-brand-foreground shrink-0">
            US
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-semibold tracking-wide truncate">Unchain Studio</h1>
              <p className="text-[10px] text-slate-400">Freelancer Portal</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mt-4 flex items-center gap-2.5">
            {freelancerProfile?.avatar_url ? (
              <img src={freelancerProfile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{displayName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-[10px] text-slate-400">{isAvailable ? "Available" : "Unavailable"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {editing ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="freelancer-nav">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                  {visibleNavItems.map((item, index) => {
                    const Icon = ICON_MAP[item.icon];
                    return (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm select-none",
                              snapshot.isDragging ? "bg-slate-700 shadow-lg" : "bg-slate-900/50"
                            )}
                          >
                            <div {...provided.dragHandleProps} className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            {Icon && <Icon className="w-[18px] h-[18px] shrink-0 text-slate-400" />}
                            <span className="text-slate-300 truncate">{item.label}</span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const isActive = activeTab === item.id;
              const badge = item.id === "notifications" && unreadCount > 0 ? unreadCount : null;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 w-full text-left",
                    isActive
                      ? "bg-brand/20 text-brand"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="relative shrink-0">
                    {Icon && <Icon className={cn("w-[18px] h-[18px]", isActive && "text-brand")} />}
                    {badge && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">{badge > 9 ? "9+" : badge}</span>}
                  </div>
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && badge && <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-slate-800/60 space-y-1">
        {!collapsed && (
          editing ? (
            <div className="flex gap-1">
              <button onClick={resetOrder} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 text-xs transition-all">Reset</button>
              <button onClick={() => setEditing(false)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand/20 text-brand hover:bg-brand/30 text-xs font-medium transition-all">
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 w-full text-sm transition-all">
              <Settings2 className="w-4 h-4 shrink-0" />
              <span>Reorder tabs</span>
            </button>
          )
        )}
        <button onClick={() => base44.auth.logout()} className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full text-sm transition-all" title="Logout">
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 w-full text-sm transition-all">
          {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}