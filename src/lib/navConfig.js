// ─── FREELANCER NAV ITEMS (source of truth, used by sidebar + admin toggles) ──
export const FREELANCER_NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard" },
  { id: "notifications", label: "Notifications" },
  { id: "myprojects",    label: "My Projects" },
  { id: "tasks",         label: "Tasks" },
  { id: "todo",          label: "My To-Do" },
  { id: "projects",      label: "Editorial" },
  { id: "captions",      label: "Captions" },
  { id: "tools",         label: "Tools" },
  { id: "music",         label: "Music" },
  { id: "meetings",      label: "Meetings" },
  { id: "shootings",     label: "Shootings" },
  { id: "notes",         label: "Notes" },
  { id: "credentials",   label: "Passwords" },
  { id: "invoices",      label: "Admin / Invoices" },
  { id: "profile",       label: "Profile" },
];

export function isVideoEditor(profile) {
  if (!profile) return false;
  const role = (profile.role || "").toLowerCase();
  if (role.includes("video editor") || role.includes("monteur")) return true;
  const tags = (profile.tags || []).map(t => String(t).toLowerCase());
  return tags.includes("video editor");
}

// Admin fully controls visibility via profile.hidden_nav_items. Empty array =
// everything visible. Full list of page IDs lives in FREELANCER_NAV_ITEMS and
// the toggle UI in FreelancerAdmin / Freelancers.
export function getHiddenNav(profile) {
  return [...(profile?.hidden_nav_items || [])];
}

// ─── CUSTOM MOBILE BOTTOM NAV PER FREELANCER ──────────────────────────────
// bottomBar: items shown in the fixed bottom bar
// showMore: whether the More button appears
// moreItems: override for the More sheet items (null = use default)
export const MOBILE_NAV_BY_ID = {
  'a83475b8-6afe-45c8-bbfb-7afcbbabfe54': { // Domnin — no More button
    bottomBar: (icons) => [
      { id: 'dashboard',  label: 'Home',     Icon: icons.LayoutDashboard },
      { id: 'todo',       label: 'My To-Do', Icon: icons.ListTodo },
      { id: 'tasks',      label: 'Tasks',    Icon: icons.ClipboardList },
      { id: 'myprojects', label: 'Projects', Icon: icons.Briefcase },
      { id: 'invoices',   label: 'Admin',    Icon: icons.FileText },
    ],
    showMore: false,
    moreItems: null,
  },
  '2ba918c3-a88e-4b9f-a570-68d8e6b0c1ed': { // Olli
    bottomBar: (icons) => [
      { id: 'dashboard',  label: 'Home',     Icon: icons.LayoutDashboard },
      { id: 'myprojects', label: 'Projects', Icon: icons.Briefcase },
      { id: 'tasks',      label: 'Tasks',    Icon: icons.ClipboardList },
      { id: 'invoices',   label: 'Admin',    Icon: icons.FileText },
    ],
    showMore: true,
    moreItems: null, // use default (hidden items filtered automatically)
  },
  '25f828d3-0855-4399-a17d-cf32f5108469': { // Jane
    bottomBar: (icons) => [
      { id: 'dashboard', label: 'Home',      Icon: icons.LayoutDashboard },
      { id: 'tasks',     label: 'Tasks',     Icon: icons.ClipboardList },
      { id: 'projects',  label: 'Calendars', Icon: icons.CalendarDays },
      { id: 'invoices',  label: 'Admin',     Icon: icons.FileText },
    ],
    showMore: true,
    moreItems: (icons) => [
      { id: 'shootings',   label: 'Shootings', Icon: icons.Camera },
      { id: 'messages',    label: 'Messages',  Icon: icons.MessageSquare },
      { id: 'profile',     label: 'Profile',   Icon: icons.User },
      { id: 'myprojects',  label: 'Projects',  Icon: icons.Briefcase },
      { id: 'todo',        label: 'To-Do',     Icon: icons.ListTodo },
      { id: 'credentials', label: 'Passwords', Icon: icons.KeyRound },
      { id: 'captions',    label: 'Captions',  Icon: icons.AlignLeft },
      { id: 'tools',       label: 'Tools',     Icon: icons.Wrench },
      { id: 'meetings',    label: 'Meetings',  Icon: icons.CalendarDays },
    ],
  },
};
