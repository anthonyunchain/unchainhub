import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Kanban, Users, Package, Mail, FileText,
  Receipt, UserCheck, BarChart3, Calendar, FileBarChart, CheckSquare, Clapperboard, Camera,
  ChevronLeft, ChevronRight, Settings2, GripVertical, Check, Shield, MonitorSmartphone
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";

const DEFAULT_NAV_ITEMS = [
  { path: "/Dashboard",      label: "Dashboard",        icon: "LayoutDashboard" },
  { path: "/Tasks",          label: "Tasks",            icon: "CheckSquare" },
  { path: "/Editorial",      label: "Calendars",        icon: "Calendar" },
  { path: "/Freelancers",    label: "Freelancers",      icon: "UserCheck" },
  { path: "/Clients",        label: "Clients",          icon: "Users" },
  { path: "/Admin",          label: "Admin",            icon: "Shield" },
  { path: "/VideoEditing",   label: "Video Editing",    icon: "Clapperboard" },
  { path: "/Shootings",      label: "Shootings",        icon: "Camera" },
  { path: "/Outreach",       label: "Outreach",         icon: "Mail" },
  { path: "/FreelancerAdmin",label: "Freelancer Portal",icon: "MonitorSmartphone" },
];

const ICON_MAP = {
  LayoutDashboard, Kanban, Users, Package, Mail, FileText,
  Receipt, UserCheck, BarChart3, Calendar, FileBarChart, CheckSquare, Clapperboard, Camera, Shield, MonitorSmartphone,
};

const STORAGE_KEY = "sidebar_nav_order";
const STORAGE_VERSION = "v8"; // bump this to force-reset stored nav order

function loadOrder() {
  try {
    const version = localStorage.getItem(STORAGE_KEY + "_version");
    if (version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY + "_version", STORAGE_VERSION);
      return DEFAULT_NAV_ITEMS;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const validPaths = new Set(DEFAULT_NAV_ITEMS.map(i => i.path));
      const filtered = parsed.filter(i => validPaths.has(i.path));
      const missing = DEFAULT_NAV_ITEMS.filter(i => !filtered.some(f => f.path === i.path));
      return [...filtered, ...missing];
    }
  } catch {}
  return DEFAULT_NAV_ITEMS;
}

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [navItems, setNavItems] = useState(loadOrder);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(navItems));
  }, [navItems]);

  useEffect(() => {
    base44.auth.me().then(u => setUserName(u?.full_name || u?.email || "")).catch(() => {});
  }, []);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(navItems);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setNavItems(items);
  };

  const resetOrder = () => {
    setNavItems(DEFAULT_NAV_ITEMS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <aside
      style={{ backgroundColor: 'var(--navy)', borderRight: '1px solid var(--navy-border)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      className={cn(
        "fixed left-0 top-0 h-screen text-white flex flex-col z-50 transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--navy-border)' }}>
        <div className="flex items-center gap-3">
          {/* Diamond mark */}
          <div style={{
            width: 24, height: 24, backgroundColor: 'var(--brand)',
            transform: 'rotate(45deg)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ transform: 'rotate(-45deg)', fontSize: '9px', fontWeight: 800, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>U</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy-text)', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.2px' }}>Unchain Studio</h1>
              <p style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: 'var(--navy-muted)', letterSpacing: '0.04em', marginTop: '1px' }} className="truncate max-w-[150px]">{userName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {editing ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="nav">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {navItems.map((item, index) => {
                    const Icon = ICON_MAP[item.icon];
                    return (
                      <Draggable key={item.path} draggableId={item.path} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-3 px-4 py-2.5 select-none"
                            style={{ background: snapshot.isDragging ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                          >
                            <div {...provided.dragHandleProps} style={{ color: 'var(--navy-muted)', cursor: 'grab' }}>
                              <GripVertical className="w-4 h-4" />
                            </div>
                            {Icon && <Icon className="w-[16px] h-[16px] shrink-0" style={{ color: 'var(--navy-muted)' }} />}
                            <span style={{ fontSize: '13px', color: 'var(--navy-muted)', fontWeight: 600 }} className="truncate">{item.label}</span>
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
          <div>
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className="flex items-center gap-3 px-5 py-2.5 transition-all duration-150"
                  style={isActive ? {
                    backgroundColor: 'var(--navy-dark)',
                    color: 'var(--navy-text)',
                    borderLeft: '3px solid var(--brand)',
                    paddingLeft: '17px',
                  } : {
                    color: 'var(--navy-muted)',
                    borderLeft: '3px solid transparent',
                    paddingLeft: '17px',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--navy-muted)'; }}
                >
                  {Icon && <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />}
                  {!collapsed && <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--navy-border)' }}>
        {!collapsed && (
          editing ? (
            <div className="flex gap-1">
              <button onClick={resetOrder} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs transition-all" style={{ color: 'var(--navy-muted)' }}>Reset</button>
              <button onClick={() => setEditing(false)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-3 px-3 py-2 w-full text-sm transition-all" style={{ color: 'var(--navy-muted)' }}>
              <Settings2 className="w-4 h-4 shrink-0" />
              <span style={{ fontSize: '12px' }}>Reorder</span>
            </button>
          )
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm transition-all"
          style={{ color: 'var(--navy-muted)' }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
          {!collapsed && <span style={{ fontSize: '12px' }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}