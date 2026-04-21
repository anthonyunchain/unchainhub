import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { registerPush, unregisterPush, getPushState } from "@/lib/pushNotifications";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, parseISO } from "date-fns";
import { enUS, fi as fiFns } from "date-fns/locale";
import { getGreeting } from "@/lib/greeting";
import { useTheme } from "@/lib/useTheme";
import {
  LayoutDashboard, Calendar, BarChart2, FileText, LogOut, Camera,
  Settings, ChevronLeft, ChevronRight, Eye, Users, TrendingUp,
  Bell, Moon, Sun, ExternalLink, Instagram, Youtube, Facebook,
  Linkedin, Globe, Download, Receipt, ClipboardList, CheckCircle2, Save,
  GraduationCap, MoreHorizontal
} from "lucide-react";
import ClientTutorialsTab from "@/components/client/ClientTutorialsTab";
import ClientCredentialsTab from "@/components/shared/ClientCredentialsTab";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Translations ───────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    dashboard: "Dashboard",
    brief: "Monthly Brief",
    briefShort: "Brief",
    reports: "Reports",
    admin: "Admin",
    shootings: "Shootings",
    upcomingShootings: "Upcoming Shootings",
    noUpcomingShootings: "No upcoming shootings",
    noShootingsScheduled: "No shootings scheduled",
    pastShootings: "Past shootings",
    crew: "Crew",
    approve: "Approve",
    decline: "Decline",
    pendingApproval: "Pending approval",
    approved: "Approved",
    declined: "Declined",
    cancelled: "Cancelled",
    cancel: "Cancel shooting",
    yourNote: "Your note",
    addNote: "Add a note (optional)...",
    contentToShoot: "Content to shoot",
    viewsThisMonth: "Views this month",
    postsPublished: "Posts published",
    editorialCalendarPdf: "Editorial Calendar PDF",
    viewsLast6Months: "Views — last 6 months",
    pendingInvoices: "Pending invoices",
    due: "Due",
    briefTitle: "Monthly brief",
    briefIntro: "Fill in the key info about next month so we can build your content calendar. The more detail, the better!",
    briefSubmitted: "Brief submitted — thank you! You can still update it below.",
    saveDraft: "Save draft",
    saved: "Saved",
    submitBrief: "Submit brief",
    submitting: "Submitting…",
    submitted: "Submitted",
    briefTitleField: "Brief title",
    briefTitlePlaceholder: "e.g. Summer launch — June 2026",
    keyDates: "Key dates & events",
    campaigns: "Campaigns & promotions",
    themes: "Main themes / topics",
    products: "Products / services to highlight",
    notes: "Additional notes",
    keyDatesPlaceholder: "Product launches, seasonal events, campaigns, holidays…",
    campaignsPlaceholder: "Ongoing promotions, partnerships, discount periods…",
    themesPlaceholder: "Topics you want to cover, content pillars for the month…",
    productsPlaceholder: "What you want to put forward this month…",
    notesPlaceholder: "Tone, constraints, anything else we should know…",
    views: "Views",
    reach: "Reach",
    followers: "Followers",
    likes: "Likes",
    postsThisMonth: "Posts this month",
    plannedTotal: (n) => `${n} planned total`,
    viewsOver12Months: "Views over 12 months",
    byPlatform: "By platform",
    viewsLabel: "views",
    followersLabel: "followers",
    contracts: "Contracts",
    invoices: "Invoices",
    noContracts: "No contracts found",
    noInvoices: "No invoices found",
    perMonth: "/ month",
    issued: "Issued",
    dueDate: "Due",
    paidDate: "Paid",
    contractStatuses: { "Actif": "Active", "Signé": "Signed", "Brouillon": "Draft", "Terminé": "Completed", "Résilié": "Terminated" },
    invoiceStatuses: { "Payée": "Paid", "En attente": "Pending", "En retard": "Overdue", "Brouillon": "Draft", "Annulée": "Cancelled" },
    lightMode: "Light mode",
    darkMode: "Dark mode",
    settings: "Settings",
    logout: "Logout",
    accountSettings: "Account settings",
    changeEmail: "Change email",
    emailPlaceholder: "new@email.com",
    updateEmail: "Update email",
    changePassword: "Change password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    updatePassword: "Update password",
    close: "Close",
    confirmationEmailSent: "Confirmation email sent.",
    passwordUpdated: "Password updated.",
    passwordsDontMatch: "Passwords don't match.",
    minChars: "Min 6 characters.",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    total: "total",
    more: "More",
    pushNotifications: "Push notifications",
    pushOn: "Notifications on",
    pushOff: "Notifications off",
    pushDenied: "Notifications are blocked. Unblock them in your browser settings, then reload this page.",
    pushIosInstall: "On iPhone, tap the share icon in Safari then \u201cAdd to Home Screen\u201d to enable notifications.",
    pushUnsupported: "Your browser doesn\u2019t support push notifications.",
    pushError: "Couldn\u2019t enable notifications. Please try again.",
    tutorials: "Tutorials",
    searchTutorials: "Search tutorials…",
    allCategories: "All categories",
    noTutorials: "No tutorials yet",
    noTutorialsFiltered: "No tutorials match your filters",
    noTutorialsDesc: "Unchain Studio will upload helpful walkthroughs here.",
    credentials: "Passwords",
    searchCredentials: "Search label, username, notes…",
    noCredentials: "No passwords yet",
    noCredentialsFiltered: "No passwords match your filters",
    noCredentialsDesc: "Unchain Studio will add your logins here.",
    loginUrl: "URL",
    username: "Username",
    password: "Password",
    openLogin: "Open login page",
    copyUrl: "Copy URL",
    copyUsername: "Copy username",
    copyPassword: "Copy password",
    showPassword: "Show",
    hidePassword: "Hide",
    urlCopied: "URL copied",
    usernameCopied: "Username copied",
    passwordCopied: "Password copied",
    twoFactor: "Two-factor authentication",
    twoFactorDesc: "Add an extra layer of security with an authenticator app (Google Authenticator, 1Password, Authy…).",
    twoFactorEnable: "Enable two-factor",
    twoFactorEnabled: "Two-factor authentication is enabled.",
    twoFactorDisable: "Disable two-factor",
    twoFactorScan: "Scan the QR code with your authenticator app, then enter the 6-digit code.",
    twoFactorVerify: "Verify",
  },
  fi: {
    dashboard: "Dashboard",
    brief: "Yhteenveto",
    briefShort: "Yhteenveto",
    reports: "Raportit",
    admin: "Ylläpito",
    shootings: "Kuvaukset",
    upcomingShootings: "Tulevat kuvaukset",
    noUpcomingShootings: "Ei tulevia kuvauksia",
    noShootingsScheduled: "Ei suunniteltuja kuvauksia",
    pastShootings: "Menneet kuvaukset",
    crew: "Tiimi",
    approve: "Hyväksy",
    decline: "Hylkää",
    pendingApproval: "Odottaa hyväksyntää",
    approved: "Hyväksytty",
    declined: "Hylätty",
    cancelled: "Peruutettu",
    cancel: "Peruuta kuvaus",
    yourNote: "Muistiinpanosi",
    addNote: "Lisää muistiinpano (valinnainen)...",
    contentToShoot: "Kuvattava sisältö",
    viewsThisMonth: "Näyttökerrat tässä kuussa",
    postsPublished: "Julkaistut julkaisut",
    editorialCalendarPdf: "Sisältökalenteri (PDF)",
    viewsLast6Months: "Näyttökerrat – viimeiset 6 kuukautta",
    pendingInvoices: "Avoimet laskut",
    due: "Eräpäivä",
    briefTitle: "Kuukausitiedote",
    briefIntro: "Täytä seuraavan kuukauden tärkeimmät tiedot, jotta voimme rakentaa sisältökalenterisi. Mitä enemmän yksityiskohtia, sitä parempi!",
    briefSubmitted: "Tiedote lähetetty, kiitos! Voit vielä päivittää sitä alla.",
    saveDraft: "Tallenna luonnos",
    saved: "Tallennettu",
    submitBrief: "Lähetä tiedote",
    submitting: "Lähetetään…",
    submitted: "Lähetetty",
    briefTitleField: "Tiedotteen otsikko",
    briefTitlePlaceholder: "esim. Kesälanseeraus — kesäkuu 2026",
    keyDates: "Tärkeät päivämäärät ja tapahtumat",
    campaigns: "Kampanjat",
    themes: "Keskeiset teemat / aiheet",
    products: "Kuukauden tuotteet / palvelut",
    notes: "Lisähuomiot",
    keyDatesPlaceholder: "Tuotelanseeraukset, kausiluontoiset tapahtumat, kampanjat, lomapäivät…",
    campaignsPlaceholder: "Käynnissä olevat kampanjat, yhteistyöt, alennusjaksot…",
    themesPlaceholder: "Aiheet, joita haluatte käsitellä, kuukauden sisältöpilarit…",
    productsPlaceholder: "Mitä haluatte nostaa esiin tässä kuussa…",
    notesPlaceholder: "Sävy, rajoitukset, muuta huomionarvoista…",
    views: "Näyttökerrat",
    reach: "Tavoittavuus",
    followers: "Seuraajat",
    likes: "Tykkäykset",
    postsThisMonth: "Julkaisut tässä kuussa",
    plannedTotal: (n) => `${n} suunniteltu yhteensä`,
    viewsOver12Months: "Näyttökerrat viimeisen 12 kuukauden ajalta",
    byPlatform: "Alustajako",
    viewsLabel: "näyttöä",
    followersLabel: "seuraajaa",
    contracts: "Sopimukset",
    invoices: "Laskut",
    noContracts: "Ei sopimuksia",
    noInvoices: "Ei laskuja",
    perMonth: "/ kk",
    issued: "Laadittu",
    dueDate: "Eräpäivä",
    paidDate: "Maksettu",
    contractStatuses: { "Actif": "Aktiivinen", "Signé": "Allekirjoitettu", "Brouillon": "Luonnos", "Terminé": "Päättynyt", "Résilié": "Irtisanottu" },
    invoiceStatuses: { "Payée": "Maksettu", "En attente": "Odottaa", "En retard": "Myöhässä", "Brouillon": "Luonnos", "Annulée": "Peruutettu" },
    lightMode: "Vaalea tila",
    darkMode: "Tumma tila",
    settings: "Asetukset",
    logout: "Kirjaudu ulos",
    accountSettings: "Tiliasetukset",
    changeEmail: "Vaihda sähköposti",
    emailPlaceholder: "uusi@sahkoposti.fi",
    updateEmail: "Päivitä sähköposti",
    changePassword: "Vaihda salasana",
    newPassword: "Uusi salasana",
    confirmPassword: "Vahvista salasana",
    updatePassword: "Päivitä salasana",
    close: "Sulje",
    confirmationEmailSent: "Vahvistussähköposti lähetetty.",
    passwordUpdated: "Salasana päivitetty.",
    passwordsDontMatch: "Salasanat eivät täsmää.",
    minChars: "Vähintään 6 merkkiä.",
    weekdays: ["Ma", "Ti", "Ke", "To", "Pe"],
    total: "yhteensä",
    more: "Lisää",
    pushNotifications: "Push-ilmoitukset",
    pushOn: "Ilmoitukset päällä",
    pushOff: "Ilmoitukset pois",
    pushDenied: "Ilmoitukset on estetty. Salli ne selaimen asetuksista ja lataa sivu uudelleen.",
    pushIosInstall: "iPhonella avaa jakovalikko Safarissa ja valitse \u201dLis\u00e4\u00e4 Koti-valikkoon\u201d n\u00e4hd\u00e4ksesi ilmoitukset.",
    pushUnsupported: "Selaimesi ei tue push-ilmoituksia.",
    pushError: "Ilmoituksia ei voitu ottaa k\u00e4ytt\u00f6\u00f6n. Yrit\u00e4 uudelleen.",
    tutorials: "Ohjevideot",
    searchTutorials: "Hae ohjevideoita…",
    allCategories: "Kaikki kategoriat",
    noTutorials: "Ei vielä ohjevideoita",
    noTutorialsFiltered: "Ei hakua vastaavia ohjevideoita",
    noTutorialsDesc: "Unchain Studio lisää tänne hyödyllisiä videoita.",
    credentials: "Salasanat",
    searchCredentials: "Hae nimeä, käyttäjätunnusta, muistiinpanoja…",
    noCredentials: "Ei vielä salasanoja",
    noCredentialsFiltered: "Ei hakua vastaavia salasanoja",
    noCredentialsDesc: "Unchain Studio lisää kirjautumistietosi tänne.",
    loginUrl: "Osoite",
    username: "Käyttäjätunnus",
    password: "Salasana",
    openLogin: "Avaa kirjautumissivu",
    copyUrl: "Kopioi osoite",
    copyUsername: "Kopioi käyttäjätunnus",
    copyPassword: "Kopioi salasana",
    showPassword: "Näytä",
    hidePassword: "Piilota",
    urlCopied: "Osoite kopioitu",
    usernameCopied: "Käyttäjätunnus kopioitu",
    passwordCopied: "Salasana kopioitu",
    twoFactor: "Kaksivaiheinen todennus",
    twoFactorDesc: "Lisää turvallisuutta todennussovelluksella (Google Authenticator, 1Password, Authy…).",
    twoFactorEnable: "Ota käyttöön",
    twoFactorEnabled: "Kaksivaiheinen todennus on käytössä.",
    twoFactorDisable: "Poista käytöstä",
    twoFactorScan: "Skannaa QR-koodi todennussovelluksella ja syötä 6-numeroinen koodi.",
    twoFactorVerify: "Vahvista",
  },
};

// ── helpers ────────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post:     "bg-blue-100 text-blue-700",
};

const STATUS_DOT = {
  "Publié":   "bg-emerald-500",
  "Planifié": "bg-blue-400",
  "En cours": "bg-amber-400",
  default:    "bg-slate-300",
};

const PLATFORM_ICON = {
  Instagram: <Instagram className="w-3 h-3" />,
  TikTok:    <Youtube className="w-3 h-3" />,
  Facebook:  <Facebook className="w-3 h-3" />,
  LinkedIn:  <Linkedin className="w-3 h-3" />,
};

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fmtDate(date, fmt, locale) {
  const s = format(date, fmt, { locale });
  return capitalizeFirst(s);
}

function KpiCard({ label, value, icon: Icon, color = "#2A69FF" }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + "18" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>{value ?? "—"}</p>
    </div>
  );
}

// ── Dashboard tab ──────────────────────────────────────────────────────────
function DashboardTab({ client, stats, content, contracts, invoices, calendarPdfs, tr, dateLocale }) {
  const { dark } = useTheme();
  const [calCurrentDate, setCalCurrentDate] = useState(new Date());
  const currentMonth = format(new Date(), "yyyy-MM");
  const monthStats = stats.filter(s => s.period === currentMonth);
  const totalViews = monthStats.reduce((s, r) => s + (r.views || 0), 0);
  const monthContent = content.filter(c => c.scheduled_date?.startsWith(currentMonth));
  const published = monthContent.filter(c => c.status === "Publié").length;

  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const period = format(d, "yyyy-MM");
    const s = stats.filter(x => x.period === period);
    chartData.push({
      month: fmtDate(d, "MMM", dateLocale),
      views: s.reduce((a, x) => a + (x.views || 0), 0),
      followers: s.reduce((a, x) => a + (x.followers_gained || 0), 0),
    });
  }

  const unpaidInvoices = invoices.filter(i => i.status !== "Payée").slice(0, 3);

  const calMonthKey = format(calCurrentDate, "yyyy-MM");
  const monthPdf = Array.isArray(calendarPdfs) ? calendarPdfs.find(p => p.month === calMonthKey) : null;
  const monthLabel = fmtDate(calCurrentDate, "MMMM yyyy", dateLocale);

  return (
    <div className="space-y-4">
      {/* Row 1: Upcoming Shootings | Download Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ClientShootings clientName={client?.company_name} tr={tr} />
        {monthPdf ? (
          <a href={monthPdf.url} target="_blank" rel="noopener noreferrer"
            className="rounded-2xl p-5 flex flex-col justify-between gap-3 transition-all hover:opacity-90"
            style={{ background: '#2A69FF', textDecoration: 'none', boxShadow: '0 4px 24px rgba(42,105,255,0.25)', minHeight: 120 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-white/70 uppercase tracking-wider">{tr.editorialCalendarPdf}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-white tracking-tight">{monthLabel}</p>
          </a>
        ) : (
          <div className="rounded-2xl p-5 flex flex-col justify-between gap-3"
            style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)', minHeight: 120 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr.editorialCalendarPdf}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--divider)' }}>
                <Calendar className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--subtle)' }}>—</p>
          </div>
        )}
      </div>

      {/* Calendar */}
      <CalendarTab content={content} calendarPdfs={calendarPdfs} currentDate={calCurrentDate} setCurrentDate={setCalCurrentDate} tr={tr} dateLocale={dateLocale} />

      {/* Analytics */}
      {chartData.some(d => d.views > 0) && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{tr.viewsLast6Months}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#21262D' : '#f0f2f5'} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? '#7d8fa3' : '#8A9BAD' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: dark ? '#7d8fa3' : '#8A9BAD' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: dark ? '#1e2736' : '#fff', color: dark ? '#e6edf3' : '#0D1B2A', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', fontSize: 12 }} />
              <Bar dataKey="views" fill="#2A69FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Client Shootings section ──────────────────────────────────────────────
function ClientShootings({ clientName, tr }) {
  const { data: shootings = [] } = useQuery({
    queryKey: ["client-shootings", clientName],
    queryFn: async () => {
      if (!clientName) return [];
      const { data, error } = await supabase
        .from("shootings")
        .select("*")
        .eq("client_name", clientName)
        .order("date", { ascending: true });
      if (error) return [];
      return data;
    },
    enabled: !!clientName,
  });

  const upcoming = shootings.filter(s => s.status !== "Completed" && s.status !== "Cancelled");

  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--divider)', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Camera style={{ width: 16, height: 16, color: 'var(--brand)' }} />
        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{tr.upcomingShootings}</p>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)' }}>{upcoming.length}</span>
      </div>
      {upcoming.length === 0 ? (
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)' }}>{tr.noUpcomingShootings}</p>
      ) : (
        <div className="space-y-2">
          {upcoming.slice(0, 3).map(s => (
            <div key={s.id} style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid var(--divider)', background: 'var(--bg)' }}>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{s.title}</p>
              <div className="flex flex-wrap items-center gap-3 mt-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)' }}>
                {s.date && <span>{format(parseISO(s.date), "d MMM", { locale: enUS })}{s.time ? ` · ${s.time}` : ""}</span>}
                {s.location && <span>📍 {s.location}</span>}
              </div>
            </div>
          ))}
          {upcoming.length > 3 && (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>+{upcoming.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client Shootings tab (full page) ──────────────────────────────────────
function ClientShootingsTab({ clientName, tr }) {
  const { dark } = useTheme();
  const qc = useQueryClient();

  const { data: shootings = [] } = useQuery({
    queryKey: ["client-shootings-full", clientName],
    queryFn: async () => {
      if (!clientName) return [];
      const { data, error } = await supabase
        .from("shootings")
        .select("*")
        .eq("client_name", clientName)
        .order("date", { ascending: true });
      if (error) return [];
      return data;
    },
    enabled: !!clientName,
  });

  // Fetch crew for these shootings
  const shootingIds = shootings.map(s => s.id);
  const { data: allCrew = [] } = useQuery({
    queryKey: ["client-shooting-crew", shootingIds],
    queryFn: async () => {
      if (shootingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shooting_assignments")
        .select("*")
        .in("shooting_id", shootingIds);
      if (error) return [];
      return data;
    },
    enabled: shootingIds.length > 0,
  });

  // Fetch linked content
  const { data: contentLinks = [] } = useQuery({
    queryKey: ["client-shooting-content", shootingIds],
    queryFn: async () => {
      if (shootingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shooting_content")
        .select("*")
        .in("shooting_id", shootingIds);
      if (error) return [];
      return data;
    },
    enabled: shootingIds.length > 0,
  });

  const contentIds = [...new Set(contentLinks.map(c => c.content_id))];
  const { data: contentItems = [] } = useQuery({
    queryKey: ["client-shooting-editorial", contentIds],
    queryFn: async () => {
      if (contentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("editorial_content")
        .select("id, title, post_type, scheduled_date")
        .in("id", contentIds);
      if (error) return [];
      return data;
    },
    enabled: contentIds.length > 0,
  });

  const [respondingId, setRespondingId] = useState(null);

  const respond = async (shootingId, newStatus, note) => {
    setRespondingId(shootingId);
    try {
      await base44.functions.invoke("respondToShooting", {
        shooting_id: shootingId,
        client_status: newStatus,
        client_note: note || null,
      });
      qc.invalidateQueries({ queryKey: ["client-shootings-full"] });
    } catch (e) {
      console.error("Failed to respond:", e);
    } finally {
      setRespondingId(null);
    }
  };

  const upcoming = shootings.filter(s => s.status !== "Completed" && s.status !== "Cancelled");
  const past = shootings.filter(s => s.status === "Completed" || s.status === "Cancelled");

  const STATUS_BADGE = {
    Planned: "bg-blue-100 text-blue-700",
    Confirmed: "bg-emerald-100 text-emerald-700",
    Completed: "bg-slate-100 text-slate-500",
    Cancelled: "bg-red-100 text-red-700",
  };
  const CLIENT_STATUS_BADGE = {
    Pending: "bg-amber-100 text-amber-700",
    Approved: "bg-emerald-100 text-emerald-700",
    Declined: "bg-red-100 text-red-600",
  };

  const TYPE_COLOR = { Reel: "bg-pink-100 text-pink-700", Story: "bg-amber-100 text-amber-700", Carousel: "bg-violet-100 text-violet-700", Post: "bg-blue-100 text-blue-700" };

  const ShootingCard = ({ s }) => {
    const crew = allCrew.filter(a => a.shooting_id === s.id);
    const linkedIds = contentLinks.filter(c => c.shooting_id === s.id).map(c => c.content_id);
    const linkedContent = contentItems.filter(c => linkedIds.includes(c.id));
    const currentStatus = s.client_status || "Pending";
    const isPending = currentStatus === "Pending";
    const isApproved = currentStatus === "Approved";
    const canAct = s.status !== "Completed" && s.status !== "Cancelled";
    const [note, setNote] = useState("");
    const isResponding = respondingId === s.id;

    return (
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--divider)', padding: '20px 24px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[s.status] || "bg-slate-100 text-slate-500"}`}>{s.status}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CLIENT_STATUS_BADGE[currentStatus]}`}>
              {currentStatus === "Approved" ? tr.approved || "Approved" : currentStatus === "Declined" ? tr.declined || "Declined" : currentStatus === "Cancelled" ? tr.cancelled || "Cancelled" : tr.pendingApproval}
            </span>
          </div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>{s.title}</p>
        </div>

        {/* Details */}
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--muted)' }}>
            {s.date && <span>{format(parseISO(s.date), "EEEE d MMMM yyyy", { locale: enUS })}{s.time ? ` · ${s.time}` : ""}</span>}
            {s.location && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>📍 {s.location}</span>}
          </div>

          {s.description && (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.description}</p>
          )}

          {/* Crew */}
          {crew.length > 0 && (
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>{tr.crew}</p>
              <div className="flex flex-wrap gap-2">
                {crew.map(a => (
                  <div key={a.id} className="flex items-center gap-2" style={{ padding: '5px 10px 5px 6px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--divider)' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {a.freelancer_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{a.freelancer_name}</span>
                    {a.role && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)' }}>· {a.role}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked content */}
          {linkedContent.length > 0 && (
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>{tr.contentToShoot || "Content to shoot"}</p>
              <div className="space-y-1.5">
                {linkedContent.map(c => (
                  <div key={c.id} className="flex items-center gap-2" style={{ padding: '6px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--divider)' }}>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${TYPE_COLOR[c.post_type] || "bg-slate-100 text-slate-500"}`}>{c.post_type}</span>
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>{c.title || "Untitled"}</span>
                    {c.scheduled_date && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)' }}>{format(parseISO(c.scheduled_date), "d MMM", { locale: enUS })}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client note (existing) */}
          {s.client_note && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: dark ? 'rgba(42,105,255,0.08)' : '#F0F4FF', border: dark ? '1px solid rgba(42,105,255,0.15)' : '1px solid #DBEAFE' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: dark ? '#93B4FF' : '#1E40AF' }}>
                <strong>{tr.yourNote || "Your note"}:</strong> {s.client_note}
              </p>
            </div>
          )}

          {/* Action area: Approve/Decline (pending) or Cancel (approved) */}
          {canAct && (isPending || isApproved) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--divider)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={tr.addNote || "Lisää muistiinpano (valinnainen)..."}
                rows={2}
                style={{ width: '100%', fontSize: 12, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--bg)', padding: '8px 12px', outline: 'none', resize: 'none', fontFamily: "'DM Mono', monospace", color: 'var(--ink)', boxSizing: 'border-box' }}
              />
              {isPending && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => respond(s.id, "Approved", note)}
                    disabled={isResponding}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: isResponding ? 0.5 : 1 }}
                  >
                    <CheckCircle2 style={{ width: 16, height: 16 }} /> {tr.approve}
                  </button>
                  <button
                    onClick={() => respond(s.id, "Declined", note)}
                    disabled={isResponding}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, background: 'transparent', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: isResponding ? 0.5 : 1 }}
                  >
                    {tr.decline}
                  </button>
                </div>
              )}
              {isApproved && (
                <button
                  onClick={() => respond(s.id, "Cancelled", note)}
                  disabled={isResponding}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 16px', borderRadius: 12, background: 'transparent', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: isResponding ? 0.5 : 1 }}
                >
                  {tr.cancel || "Cancel shooting"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (shootings.length === 0) {
    return (
      <div className="text-center py-16">
        <Camera style={{ width: 40, height: 40, color: 'var(--muted)', opacity: 0.3, margin: '0 auto 12px' }} />
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: 'var(--muted)' }}>{tr.noShootingsScheduled}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcoming.map(s => <ShootingCard key={s.id} s={s} />)}
        </div>
      )}
      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 list-none py-2 select-none" style={{ color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>
            {tr.pastShootings} ({past.length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 opacity-70">
            {past.map(s => <ShootingCard key={s.id} s={s} />)}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Calendar tab ───────────────────────────────────────────────────────────
function CalendarTab({ content, calendarPdfs = [], currentDate: externalDate, setCurrentDate: externalSetDate, tr, dateLocale }) {
  const { dark } = useTheme();
  const [internalDate, setInternalDate] = useState(new Date());
  const [dayPage, setDayPage] = useState(0);
  const touchStartX = useRef(null);
  const currentDate = externalDate ?? internalDate;
  const setCurrentDate = externalSetDate ?? setInternalDate;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;

  const calDays7 = [...Array(startPad).fill(null), ...days];
  while (calDays7.length % 7 !== 0) calDays7.push(null);
  const calWeeks = [];
  for (let i = 0; i < calDays7.length; i += 7) calWeeks.push(calDays7.slice(i, i + 7));

  const WEEKDAY_LABELS = tr?.weekdays || ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const calDays5 = calWeeks.flatMap(week => week.slice(0, 5));

  const contentByDay = {};
  content.forEach(c => {
    if (!c.scheduled_date) return;
    const key = c.scheduled_date.split("T")[0];
    if (!contentByDay[key]) contentByDay[key] = [];
    contentByDay[key].push(c);
  });

  const monthContent = content.filter(c =>
    c.scheduled_date && c.scheduled_date.startsWith(format(currentDate, "yyyy-MM"))
  );

  const mobileColSets = [[0, 1, 2], [2, 3, 4]];
  const mobileColIdx = mobileColSets[dayPage];
  const mobileHeaders = mobileColIdx.map(i => WEEKDAY_LABELS[i]);
  const mobileCells = calWeeks.flatMap(week => mobileColIdx.map(i => week[i] ?? null));

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) setDayPage(p => Math.min(1, Math.max(0, p + (dx < 0 ? 1 : -1))));
    touchStartX.current = null;
  };

  const shiftMonth = (dir) => {
    setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    setDayPage(0);
  };

  const DayCell = ({ day, compact = false }) => {
    const maxItems = compact ? 4 : 3;
    if (!day) return (
      <div style={{ borderBottom: '1px solid var(--divider)', borderRight: '1px solid var(--divider)', background: dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)', minHeight: compact ? 100 : 110, padding: 4 }} />
    );
    const key = format(day, "yyyy-MM-dd");
    const items = contentByDay[key] || [];
    const isToday = isSameDay(day, new Date());
    return (
      <div style={{ borderBottom: '1px solid var(--divider)', borderRight: '1px solid var(--divider)', background: isToday ? (dark ? 'rgba(77,142,255,0.08)' : 'rgba(42,105,255,0.04)') : 'transparent', minHeight: compact ? 100 : 110, padding: compact ? '6px 8px' : '6px' }}>
        <span className={`text-[11px] font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full mb-1 ${isToday ? "bg-[#2A69FF] text-white" : ""}`}
          style={!isToday ? { color: 'var(--muted)' } : {}}>
          {format(day, "d")}
        </span>
        <div className="space-y-0.5">
          {items.slice(0, maxItems).map(c => (
            <div key={c.id} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate ${TYPE_COLOR[c.post_type] || "bg-slate-100 text-slate-500"}`}>
              {c.title || c.post_type}
            </div>
          ))}
          {items.length > maxItems && <div className="text-[9px] px-1" style={{ color: 'var(--muted)' }}>+{items.length - maxItems}</div>}
        </div>
      </div>
    );
  };

  const totalLabel = tr?.total || "total";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => shiftMonth(-1)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
          {fmtDate(currentDate, "MMMM yyyy", dateLocale)}
        </span>
        <button onClick={() => shiftMonth(1)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        {["Reel", "Story", "Carousel", "Post"].map(t => {
          const count = monthContent.filter(c => c.post_type === t).length;
          if (!count) return null;
          return (
            <div key={t} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${TYPE_COLOR[t] || "bg-slate-100 text-slate-500"}`}>
              {count} {t}{count > 1 ? "s" : ""}
            </div>
          );
        })}
        <div className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">
          {monthContent.length} {totalLabel}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
        <div className="sm:hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--divider)' }}>
            {mobileHeaders.map(d => (
              <div key={d} className="text-center text-[10px] font-mono py-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-3">
            {mobileCells.map((day, i) => <DayCell key={day ? format(day, "yyyy-MM-dd") + `-m${i}` : `m-pad-${i}`} day={day} compact />)}
          </div>
          <div className="flex justify-center gap-1.5 py-2.5">
            {[0, 1].map(p => (
              <button key={p} onClick={() => setDayPage(p)}
                style={{ height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', transition: 'all 200ms', width: dayPage === p ? 12 : 6, background: dayPage === p ? 'var(--brand)' : 'var(--divider)' }} />
            ))}
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="grid grid-cols-5" style={{ borderBottom: '1px solid var(--divider)' }}>
            {WEEKDAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-mono py-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-5">
            {calDays5.map((day, i) => <DayCell key={day ? format(day, "yyyy-MM-dd") : `pad-${i}`} day={day} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reports tab ────────────────────────────────────────────────────────────
function ReportsTab({ stats, content, tr, dateLocale }) {
  const { dark } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const shiftMonth = (dir) => {
    const d = new Date(selectedMonth + "-01");
    d.setMonth(d.getMonth() + dir);
    setSelectedMonth(format(d, "yyyy-MM"));
  };

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(format(d, "yyyy-MM"));
  }

  const monthStats = stats.filter(s => s.period === selectedMonth);
  const totalViews = monthStats.reduce((s, r) => s + (r.views || 0), 0);
  const totalReach = monthStats.reduce((s, r) => s + (r.reach || 0), 0);
  const totalFollowers = monthStats.reduce((s, r) => s + (r.followers_gained || 0), 0);
  const totalLikes = monthStats.reduce((s, r) => s + (r.likes || 0), 0);

  const chartData = months.map(period => {
    const d = new Date(period + "-01");
    const s = stats.filter(x => x.period === period);
    return {
      month: fmtDate(d, "MMM", dateLocale),
      views: s.reduce((a, x) => a + (x.views || 0), 0),
      followers: s.reduce((a, x) => a + (x.followers_gained || 0), 0),
      reach: s.reduce((a, x) => a + (x.reach || 0), 0),
    };
  });

  const monthContent = content.filter(c => c.scheduled_date?.startsWith(selectedMonth));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => shiftMonth(-1)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
          {fmtDate(new Date(selectedMonth + "-01"), "MMMM yyyy", dateLocale)}
        </span>
        <button onClick={() => shiftMonth(1)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={tr.views} value={totalViews.toLocaleString()} icon={Eye} color="#2A69FF" />
        <KpiCard label={tr.reach} value={totalReach.toLocaleString()} icon={Globe} color="#8B5CF6" />
        <KpiCard label={tr.followers} value={`+${totalFollowers}`} icon={Users} color="#10B981" />
        <KpiCard label={tr.likes} value={totalLikes.toLocaleString()} icon={TrendingUp} color="#F59E0B" />
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>{tr.postsThisMonth}</p>
        <p className="text-3xl font-extrabold" style={{ color: 'var(--ink)' }}>{monthContent.filter(c => c.status === "Publié").length}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{tr.plannedTotal(monthContent.length)}</p>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{tr.viewsOver12Months}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#21262D' : '#f0f2f5'} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: dark ? '#7d8fa3' : '#8A9BAD' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: dark ? '#7d8fa3' : '#8A9BAD' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: dark ? '#1e2736' : '#fff', color: dark ? '#e6edf3' : '#0D1B2A', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', fontSize: 11 }} />
            <Bar dataKey="views" fill="#2A69FF" radius={[4, 4, 0, 0]} name={tr.views} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {monthStats.length > 1 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{tr.byPlatform}</p>
          <div className="space-y-2">
            {monthStats.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.platform || "All"}</span>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{(s.views || 0).toLocaleString()} {tr.viewsLabel}</span>
                  <span>+{s.followers_gained || 0} {tr.followersLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Contracts tab ──────────────────────────────────────────────────────────
function ContractsTab({ contracts, contractDocuments, tr, dateLocale }) {
  const STATUS_COLOR = {
    "Actif": "bg-emerald-100 text-emerald-700",
    "Signé": "bg-blue-100 text-blue-700",
    "Brouillon": "bg-slate-100 text-slate-500",
    "Terminé": "bg-amber-100 text-amber-700",
    "Résilié": "bg-red-100 text-red-600",
  };

  if (!contracts.length && !contractDocuments.length) return (
    <div className="text-center py-20 text-slate-400">
      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{tr.noContracts}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {contracts.map(c => (
        <div key={c.id} className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] || "bg-slate-100 text-slate-500"}`}>
                  {tr.contractStatuses[c.status] || c.status}
                </span>
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>{c.title || "Contract"}</p>
              {c.start_date && (
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {fmtDate(new Date(c.start_date), "d MMM yyyy", dateLocale)}
                  {c.end_date && ` → ${fmtDate(new Date(c.end_date), "d MMM yyyy", dateLocale)}`}
                </p>
              )}
              {c.monthly_amount > 0 && (
                <p className="text-sm font-semibold mt-2" style={{ color: 'var(--ink)' }}>{c.monthly_amount.toLocaleString("fr-FR")} € {tr.perMonth}</p>
              )}
              {c.notes && <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>{c.notes}</p>}
            </div>
          </div>
        </div>
      ))}
      {contractDocuments.map((url, i) => {
        const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
        return (
          <a key={`doc-${i}`} href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl p-5 transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)', textDecoration: 'none' }}>
            <FileText className="w-5 h-5 shrink-0" style={{ color: 'var(--muted)' }} />
            <span className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{name}</span>
          </a>
        );
      })}
    </div>
  );
}

// ── Invoices tab ───────────────────────────────────────────────────────────
function InvoicesTab({ invoices, tr, dateLocale }) {
  const STATUS_COLOR = {
    "Payée": "bg-emerald-100 text-emerald-700",
    "En attente": "bg-amber-100 text-amber-700",
    "En retard": "bg-red-100 text-red-600",
    "Brouillon": "bg-slate-100 text-slate-500",
    "Annulée": "bg-slate-100 text-slate-400",
  };

  if (!invoices.length) return (
    <div className="text-center py-20 text-slate-400">
      <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{tr.noInvoices}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {invoices.map(inv => (
        <div key={inv.id} className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[inv.status] || "bg-slate-100 text-slate-500"}`}>
                  {tr.invoiceStatuses[inv.status] || inv.status}
                </span>
                {inv.invoice_number && (
                  <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{inv.invoice_number}</span>
                )}
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                {(inv.total_with_tax || inv.total_amount || 0).toLocaleString("fr-FR")} €
              </p>
              {inv.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>{inv.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--muted)' }}>
                {inv.issue_date && <span>{tr.issued} {fmtDate(new Date(inv.issue_date), "d MMM yyyy", dateLocale)}</span>}
                {inv.due_date && <span>· {tr.dueDate} {fmtDate(new Date(inv.due_date), "d MMM yyyy", dateLocale)}</span>}
                {inv.paid_date && <span>· {tr.paidDate} {fmtDate(new Date(inv.paid_date), "d MMM yyyy", dateLocale)}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Admin tab ──────────────────────────────────────────────────────────────
function AdminTab({ contracts, contractDocuments, invoices, clientId, clientName, tr, dateLocale }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{tr.contracts}</p>
        <ContractsTab contracts={contracts} contractDocuments={contractDocuments} tr={tr} dateLocale={dateLocale} />
      </div>
      <div>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{tr.invoices}</p>
        <InvoicesTab invoices={invoices} tr={tr} dateLocale={dateLocale} />
      </div>
      {clientId && (
        <div>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{tr.credentials || "Passwords"}</p>
          <ClientCredentialsTab clientId={clientId} clientName={clientName} canEdit={false} tr={tr} />
        </div>
      )}
    </div>
  );
}

// ── Settings dialog ────────────────────────────────────────────────────────
function MfaSection({ tr }) {
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [pending, setPending] = useState(null); // { factorId, qrSvg, secret }
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const verified = factors.find(f => f.status === "verified");

  const startEnroll = async () => {
    setMsg("");
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setEnrolling(false);
    if (error) { setMsg(error.message); return; }
    setPending({
      factorId: data.id,
      qrSvg: data.totp?.qr_code,
      secret: data.totp?.secret,
    });
    setCode("");
  };

  const verify = async () => {
    if (!pending || !code) return;
    setMsg("");
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: pending.factorId });
    if (chErr) { setMsg(chErr.message); return; }
    const { error } = await supabase.auth.mfa.verify({
      factorId: pending.factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    if (error) { setMsg(error.message); return; }
    setPending(null);
    setCode("");
    await refresh();
  };

  const cancelEnroll = async () => {
    if (pending?.factorId) {
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => {});
    }
    setPending(null);
    setCode("");
    setMsg("");
  };

  const disable = async () => {
    if (!verified) return;
    setMsg("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    if (error) { setMsg(error.message); return; }
    await refresh();
  };

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {tr.twoFactor || "Two-factor authentication"}
      </p>

      {loading ? (
        <p className="text-xs text-slate-400">…</p>
      ) : pending ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            {tr.twoFactorScan || "Scan the QR code with your authenticator app, then enter the 6-digit code."}
          </p>
          {pending.qrSvg && (
            <div className="flex justify-center bg-white p-3 rounded-xl border border-slate-200"
              dangerouslySetInnerHTML={{ __html: pending.qrSvg }} />
          )}
          {pending.secret && (
            <p className="text-[11px] text-slate-500 break-all text-center font-mono">{pending.secret}</p>
          )}
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 text-center tracking-widest font-mono"
          />
          {msg && <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={cancelEnroll}
              className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-2.5 text-sm font-semibold">
              {tr.cancel || "Cancel"}
            </button>
            <button onClick={verify} disabled={code.length !== 6}
              className="flex-1 bg-[#2A69FF] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
              {tr.twoFactorVerify || "Verify"}
            </button>
          </div>
        </div>
      ) : verified ? (
        <div className="space-y-2">
          <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs">
            {tr.twoFactorEnabled || "Two-factor authentication is enabled."}
          </div>
          {msg && <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">{msg}</p>}
          <button onClick={disable}
            className="w-full bg-red-50 text-red-600 rounded-xl py-2.5 text-sm font-semibold">
            {tr.twoFactorDisable || "Disable two-factor"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {tr.twoFactorDesc || "Add an extra layer of security with an authenticator app (Google Authenticator, 1Password, Authy…)."}
          </p>
          {msg && <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">{msg}</p>}
          <button onClick={startEnroll} disabled={enrolling}
            className="w-full bg-[#2A69FF] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            {enrolling ? "…" : (tr.twoFactorEnable || "Enable two-factor")}
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsDialog({ open, onClose, tr }) {
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  // Push state: 'enabled' | 'disabled' | 'denied' | 'ios-install' | 'unsupported' | 'loading'
  const [pushState, setPushState] = useState('loading');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setPushMsg("");
    getPushState().then(setPushState);
  }, [open]);

  const togglePush = async () => {
    setPushLoading(true);
    setPushMsg("");
    if (pushState === 'enabled') {
      await unregisterPush();
      setPushState('disabled');
    } else if (pushState === 'disabled') {
      const res = await registerPush();
      if (res.ok) {
        setPushState('enabled');
      } else if (res.reason === 'denied') {
        setPushState('denied');
        setPushMsg(tr.pushDenied);
      } else if (res.reason === 'ios-install') {
        setPushState('ios-install');
        setPushMsg(tr.pushIosInstall);
      } else if (res.reason === 'unsupported') {
        setPushState('unsupported');
        setPushMsg(tr.pushUnsupported);
      } else {
        setPushMsg(tr.pushError);
      }
    }
    setPushLoading(false);
  };

  const updateEmail = async () => {
    if (!email) return;
    const { error } = await supabase.auth.updateUser({ email });
    setEmailMsg(error ? error.message : tr.confirmationEmailSent);
    if (!error) setEmail("");
  };

  const updatePw = async () => {
    if (newPw !== confirmPw) { setPwMsg(tr.passwordsDontMatch); return; }
    if (newPw.length < 6) { setPwMsg(tr.minChars); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwMsg(error ? error.message : tr.passwordUpdated);
    if (!error) { setNewPw(""); setConfirmPw(""); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800">{tr.accountSettings}</h2>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tr.changeEmail}</p>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={tr.emailPlaceholder}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          {emailMsg && <p className={`text-xs px-3 py-2 rounded-lg ${emailMsg.includes("sent") || emailMsg.includes("lähetetty") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{emailMsg}</p>}
          <button onClick={updateEmail} disabled={!email} className="w-full bg-[#2A69FF] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">{tr.updateEmail}</button>
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tr.changePassword}</p>
          <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder={tr.newPassword}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          <input value={confirmPw} onChange={e => setConfirmPw(e.target.value)} type="password" placeholder={tr.confirmPassword}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          {pwMsg && <p className={`text-xs px-3 py-2 rounded-lg ${pwMsg.includes("updated") || pwMsg.includes("päivitetty") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{pwMsg}</p>}
          <button onClick={updatePw} disabled={!newPw || !confirmPw} className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">{tr.updatePassword}</button>
        </div>
        <MfaSection tr={tr} />
        {(() => {
          const pushEnabled = pushState === 'enabled';
          const canInteract = pushState === 'enabled' || pushState === 'disabled';
          const hint =
            pushState === 'denied'      ? tr.pushDenied :
            pushState === 'ios-install' ? tr.pushIosInstall :
            pushState === 'unsupported' ? tr.pushUnsupported :
            pushMsg || null;
          return (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{tr.pushNotifications}</p>
              <button
                onClick={togglePush}
                disabled={pushLoading || !canInteract}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 12,
                  background: pushEnabled ? 'rgba(42,105,255,0.07)' : 'var(--subtle, #f4f4f5)',
                  border: `1px solid ${pushEnabled ? 'rgba(42,105,255,0.2)' : '#e4e4e7'}`,
                  cursor: (pushLoading || !canInteract) ? 'not-allowed' : 'pointer',
                  opacity: (pushLoading || !canInteract) ? 0.55 : 1,
                }}
              >
                <span style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: pushEnabled ? '#2A69FF' : '#52525b' }}>
                  {pushEnabled ? tr.pushOn : tr.pushOff}
                </span>
                <span style={{ position: 'relative', width: 36, height: 20, borderRadius: 10, background: pushEnabled ? '#2A69FF' : '#d4d4d8', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: pushEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </span>
              </button>
              {hint && (
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{hint}</p>
              )}
            </div>
          );
        })()}
        <button onClick={onClose} className="w-full text-sm text-slate-400 hover:text-slate-600 py-1">{tr.close}</button>
      </div>
    </div>
  );
}

// ── Monthly Brief form ──────────────────────────────────────────────────────
function BriefTab({ clientName, tr, dateLocale }) {
  const nextMonth = format(addMonths(new Date(), 1), "yyyy-MM");
  const [month, setMonth] = useState(nextMonth);
  const [form, setForm] = useState({ title: "", key_events: "", campaigns: "", themes: "", products: "", notes: "" });
  const [briefId, setBriefId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [loading, setLoading] = useState(true);

  const shiftMonth = (dir) => {
    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() + dir);
    setMonth(format(d, "yyyy-MM"));
  };

  useEffect(() => {
    if (!clientName) return;
    setLoading(true);
    setSaved(false);
    supabase.from("monthly_briefs")
      .select("*")
      .eq("client_name", clientName)
      .eq("month", month)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBriefId(data.id);
          setSubmitted(!!data.submitted_at);
          setForm({ title: data.title || "", key_events: data.key_events || "", campaigns: data.campaigns || "", themes: data.themes || "", products: data.products || "", notes: data.notes || "" });
        } else {
          setBriefId(null);
          setSubmitted(false);
          setForm({ title: "", key_events: "", campaigns: "", themes: "", products: "", notes: "" });
        }
        setLoading(false);
      });
  }, [clientName, month]);

  const handleSave = async (submit = false) => {
    setSaving(true);
    setSaveError(null);
    const payload = {
      client_name: clientName,
      month,
      ...form,
      updated_at: new Date().toISOString(),
      ...(submit ? { submitted_at: new Date().toISOString() } : {}),
    };
    const { data, error } = await supabase
      .from("monthly_briefs")
      .upsert(payload, { onConflict: "client_name,month" })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      if (data?.id) setBriefId(data.id);
      if (submit) setSubmitted(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const briefFields = [
    { key: "title",      label: tr.briefTitleField, placeholder: tr.briefTitlePlaceholder, rows: 1 },
    { key: "key_events", label: tr.keyDates,         placeholder: tr.keyDatesPlaceholder },
    { key: "campaigns",  label: tr.campaigns,        placeholder: tr.campaignsPlaceholder },
    { key: "themes",     label: tr.themes,           placeholder: tr.themesPlaceholder },
    { key: "products",   label: tr.products,         placeholder: tr.productsPlaceholder },
    { key: "notes",      label: tr.notes,            placeholder: tr.notesPlaceholder },
  ];

  const monthLabel = fmtDate(new Date(month + "-01"), "MMMM yyyy", dateLocale);
  const isNextMonth = month === nextMonth;
  const isFuture = month >= nextMonth;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => shiftMonth(-1)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
      </div>

      {submitted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #6ee7b7', marginBottom: 16 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: '#059669' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#059669', margin: 0 }}>{tr.briefSubmitted}</p>
        </div>
      )}

      {isNextMonth && !submitted && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--divider)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px 0' }}>{tr.briefTitle} — {monthLabel}</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{tr.briefIntro}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {briefFields.map(f => (
            <div key={f.key} style={{ background: 'var(--card)', border: '1px solid var(--divider)', borderRadius: 16, padding: '14px 16px' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{f.label}</p>
              <textarea
                value={form[f.key]}
                onChange={e => {
                  setForm(v => ({ ...v, [f.key]: e.target.value }));
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder={f.placeholder}
                rows={f.rows ?? 3}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, resize: 'none', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
            </div>
          ))}

          {saveError && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fca5a5' }}>
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{saveError}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => handleSave(false)} disabled={saving}
              style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--divider)', background: 'var(--card)', fontSize: 13, fontWeight: 600, color: saved ? '#059669' : 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {saved ? <><CheckCircle2 style={{ width: 15, height: 15 }} /> {tr.saved}</> : <><Save style={{ width: 15, height: 15 }} /> {tr.saveDraft}</>}
            </button>
            {isFuture && (
              <button onClick={() => handleSave(true)} disabled={saving || submitted}
                style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: submitted ? '#d1fae5' : 'var(--brand)', fontSize: 13, fontWeight: 700, color: submitted ? '#059669' : '#fff', cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {submitted
                  ? <><CheckCircle2 style={{ width: 15, height: 15 }} /> {tr.submitted}</>
                  : saving ? tr.submitting
                  : <><CheckCircle2 style={{ width: 15, height: 15 }} /> {tr.submitBrief}</>
                }
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main portal ────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [clientRecord, setClientRecord] = useState(null);
  const [content, setContent] = useState([]);
  const [stats, setStats] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("cp_lang") || "en");
  const lastScrollY = useRef(0);
  const { dark, toggle } = useTheme();

  const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const dateLocale = lang === "fi" ? fiFns : enUS;

  const toggleLang = () => {
    const next = lang === "en" ? "fi" : "en";
    setLang(next);
    localStorage.setItem("cp_lang", next);
  };

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const diff = current - lastScrollY.current;
      if (diff > 6) setNavVisible(false);
      else if (diff < -4) setNavVisible(true);
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const clientName = clientRecord?.company_name || user?.user_metadata?.company_name || user?.email?.split("@")[0] || "";
  const greeting = useMemo(() => getGreeting("", lang), [lang]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("Not authenticated");
        setUser(authUser);

        let { data: clientRows } = await supabase
          .from("clients")
          .select("id, company_name, portal_user_id, contact_email, editorial_calendar_pdfs, contract_documents, default_language")
          .eq("portal_user_id", authUser.id)
          .limit(1);

        if (!clientRows?.length) {
          const { data: emailRows } = await supabase
            .from("clients")
            .select("id, company_name, portal_user_id, contact_email, editorial_calendar_pdfs, contract_documents, default_language")
            .eq("contact_email", authUser.email)
            .limit(1);
          clientRows = emailRows;
        }

        const client = clientRows?.[0] || null;
        setClientRecord(client);

        // Always apply client's default language on load
        if (client?.default_language) {
          setLang(client.default_language);
        }

        if (!client?.company_name) { setLoading(false); return; }

        const cName = client.company_name;
        const cId = client.id;

        const [contentRes, contractsRes, invoicesRes, statsRes] = await Promise.all([
          supabase
            .from("editorial_content")
            .select("id, title, post_type, scheduled_date, status, client_name, client_id")
            .or(`client_name.eq.${cName},client_id.eq.${cId}`)
            .order("scheduled_date", { ascending: false }),
          supabase
            .from("contracts")
            .select("id, title, status, monthly_amount, start_date, end_date, notes, client_name")
            .eq("client_name", cName)
            .order("start_date", { ascending: false }),
          supabase
            .from("invoices")
            .select("id, invoice_number, description, total_amount, total_with_tax, status, issue_date, due_date, paid_date, client_name")
            .eq("client_name", cName)
            .order("issue_date", { ascending: false }),
          supabase
            .from("client_stats")
            .select("id, period, platform, views, reach, likes, comments, shares, followers_gained, notes")
            .eq("client_name", cName)
            .order("period", { ascending: false }),
        ]);

        setContent(contentRes.data || []);
        setContracts(contractsRes.data || []);
        setInvoices(invoicesRes.data || []);
        setStats(statsRes.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <p className="text-slate-700 font-medium mb-2">Unable to load your portal</p>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    </div>
  );

  const initials = clientName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "CL";

  const TABS = [
    { key: "dashboard", label: tr.dashboard,  icon: LayoutDashboard },
    { key: "shootings", label: tr.shootings,   icon: Camera },
    { key: "brief",     label: tr.brief,       icon: ClipboardList },
    { key: "reports",   label: tr.reports,     icon: BarChart2 },
    { key: "tutorials", label: tr.tutorials || "Tutorials", icon: GraduationCap },
    { key: "admin",     label: tr.admin,       icon: Settings },
  ];
  const MOBILE_TABS = TABS.filter(t => ["dashboard", "shootings", "brief"].includes(t.key));
  const MORE_TABS = TABS.filter(t => ["reports", "tutorials", "admin"].includes(t.key));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      {/* Topbar */}
      <div style={{ paddingTop: 'max(28px, env(safe-area-inset-top))', paddingBottom: 20, paddingLeft: 20, paddingRight: 20 }}>
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>U</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.2px' }}>Unchain Studio</span>
          </div>

          {/* Desktop tabs */}
          <div className="hidden md:flex items-center gap-1 p-1" style={{ background: 'var(--card)', borderRadius: 'var(--pill-radius)', boxShadow: 'var(--card-shadow)', border: '1px solid var(--divider)' }}>
            {TABS.map((t) => {
              const isAdmin = t.key === "admin";
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500,
                    padding: isAdmin ? '6px 10px' : '6px 14px',
                    borderRadius: 'var(--pill-radius)',
                    background: activeTab === t.key ? 'var(--brand)' : 'transparent',
                    color: activeTab === t.key ? '#fff' : 'var(--muted)',
                    border: 'none', cursor: 'pointer', transition: 'all 200ms',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <t.icon style={{ width: 12, height: 12 }} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Language toggle + Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              style={{
                height: 28, paddingLeft: 10, paddingRight: 10,
                borderRadius: 8,
                border: '1px solid var(--divider)',
                background: 'var(--card)',
                fontSize: 11, fontWeight: 700,
                fontFamily: "'DM Mono', monospace",
                color: 'var(--muted)',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--divider)'; }}
            >
              {lang === "en" ? "FI" : "EN"}
            </button>

            {/* Avatar */}
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</span>
              </button>
              {menuOpen && (
                <div style={{ position: 'fixed', top: 72, right: 20, background: 'var(--card)', borderRadius: 20, boxShadow: 'var(--card-shadow-hover)', border: '1px solid var(--divider)', zIndex: 9999, minWidth: 200 }}
                  onClick={() => setMenuOpen(false)}>
                  <div style={{ padding: '12px 0' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--divider)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{clientName}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: '4px 0 0 0', fontFamily: "'DM Mono', monospace" }}>{user?.email}</p>
                    </div>
                    <button onClick={toggle}
                      style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {dark ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}
                        {dark ? tr.lightMode : tr.darkMode}
                      </span>
                      <span style={{ width: 32, height: 18, borderRadius: 9, background: dark ? 'var(--brand)' : 'var(--subtle)', position: 'relative', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 2, left: dark ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 200ms' }} />
                      </span>
                    </button>
                    <button onClick={() => setSettingsOpen(true)}
                      style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                      <Settings style={{ width: 14, height: 14 }} /> {tr.settings}
                    </button>
                    <button onClick={() => base44.auth.logout()}
                      style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#E8421A', borderTop: '1px solid var(--divider)' }}>
                      <LogOut style={{ width: 14, height: 14 }} /> {tr.logout}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-5 pb-36 md:pb-8 mx-auto" style={{ maxWidth: 1400 }}>
        {/* Greeting */}
        {activeTab === "dashboard" && (
          <div className="mb-5">
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0 }}>
              {greeting}
            </h2>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--muted)', marginTop: 6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {lang === "fi"
                ? capitalizeFirst(format(new Date(), "EEEE, d. MMMM yyyy", { locale: fiFns }))
                : format(new Date(), "EEEE, d MMMM yyyy", { locale: enUS })
              }
            </p>
          </div>
        )}

        {/* Page title for other tabs */}
        {activeTab !== "dashboard" && (
          <div className="mb-5">
            {(() => { const t = TABS.find(x => x.key === activeTab); return t ? (
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0 }}>
                {t.label}
              </h2>
            ) : null; })()}
          </div>
        )}

        {activeTab === "dashboard" && <DashboardTab client={clientRecord} stats={stats} content={content} contracts={contracts} invoices={invoices} calendarPdfs={clientRecord?.editorial_calendar_pdfs || []} tr={tr} dateLocale={dateLocale} />}
        {activeTab === "shootings" && <ClientShootingsTab clientName={clientName} tr={tr} />}
        {activeTab === "brief"     && <BriefTab clientName={clientName} tr={tr} dateLocale={dateLocale} />}
        {activeTab === "reports"   && <ReportsTab stats={stats} content={content} tr={tr} dateLocale={dateLocale} />}
        {activeTab === "tutorials" && <ClientTutorialsTab tr={tr} />}
        {activeTab === "admin"     && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <AdminTab
              contracts={contracts}
              contractDocuments={clientRecord?.contract_documents || []}
              invoices={invoices}
              clientId={clientRecord?.id}
              clientName={clientName}
              tr={tr}
              dateLocale={dateLocale}
            />
          </div>
        )}
      </div>

      {/* Mobile "more" backdrop */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
      )}

      {/* Mobile "more" popup */}
      {moreOpen && (
        <div
          className="md:hidden fixed z-50"
          style={{
            bottom: `calc(84px + env(safe-area-inset-bottom))`,
            right: 16,
            background: dark ? 'rgba(30,35,45,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderRadius: 18,
            border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            minWidth: 180,
          }}
        >
          {MORE_TABS.map((t, i) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setMoreOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '13px 18px',
                  background: active ? 'var(--brand-muted)' : 'transparent',
                  border: 'none', borderTop: i > 0 ? '1px solid var(--divider)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <t.icon style={{ width: 17, height: 17, color: active ? 'var(--brand)' : dark ? 'rgba(255,255,255,0.5)' : 'rgba(30,40,70,0.55)', strokeWidth: 1.8, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--brand)' : 'var(--ink)' }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed left-4 right-4 z-50 flex items-center"
        style={{
          bottom: `calc(12px + env(safe-area-inset-bottom))`,
          height: 64,
          borderRadius: 28,
          background: dark ? 'rgba(30,35,45,0.82)' : 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.9)',
          boxShadow: dark
            ? '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)'
            : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,1) inset',
          transform: navVisible ? 'translateY(0)' : 'translateY(calc(100% + 20px))',
          transition: 'transform 320ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.9) 60%, transparent)', pointerEvents: 'none' }} />

        {MOBILE_TABS.map(t => {
          const active = activeTab === t.key;
          const shortLabel = t.key === "brief" ? tr.briefShort : t.label;
          return (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setMoreOpen(false); }}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative"
              style={{ background: 'none', border: 'none', cursor: 'pointer', height: '100%' }}>
              {active && (
                <div style={{ position: 'absolute', width: 64, height: 52, borderRadius: 16, background: 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)', boxShadow: '0 4px 12px rgba(42,105,255,0.35)', top: '50%', transform: 'translateY(-50%)' }} />
              )}
              <t.icon style={{ width: 19, height: 19, position: 'relative', zIndex: 1, color: active ? '#fff' : dark ? 'rgba(255,255,255,0.4)' : 'rgba(30,40,70,0.5)', strokeWidth: active ? 2.2 : 1.8 }} />
              <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: '0.04em', position: 'relative', zIndex: 1, color: active ? '#fff' : dark ? 'rgba(255,255,255,0.4)' : 'rgba(30,40,70,0.5)', textTransform: 'uppercase' }}>
                {shortLabel}
              </span>
            </button>
          );
        })}

        {/* Lisää (More) button */}
        {(() => {
          const moreActive = MORE_TABS.some(t => t.key === activeTab);
          return (
            <button
              onClick={() => setMoreOpen(o => !o)}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative"
              style={{ background: 'none', border: 'none', cursor: 'pointer', height: '100%' }}
            >
              {(moreOpen || moreActive) && (
                <div style={{ position: 'absolute', width: 64, height: 52, borderRadius: 16, background: 'linear-gradient(160deg, #2A69FF 0%, #1a54e0 100%)', boxShadow: '0 4px 12px rgba(42,105,255,0.35)', top: '50%', transform: 'translateY(-50%)' }} />
              )}
              <MoreHorizontal style={{ width: 19, height: 19, position: 'relative', zIndex: 1, color: (moreOpen || moreActive) ? '#fff' : dark ? 'rgba(255,255,255,0.4)' : 'rgba(30,40,70,0.5)', strokeWidth: 1.8 }} />
              <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: '0.04em', position: 'relative', zIndex: 1, color: (moreOpen || moreActive) ? '#fff' : dark ? 'rgba(255,255,255,0.4)' : 'rgba(30,40,70,0.5)', textTransform: 'uppercase' }}>
                {tr.more || "Lisää"}
              </span>
            </button>
          );
        })()}
      </nav>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} tr={tr} />
    </div>
  );
}
