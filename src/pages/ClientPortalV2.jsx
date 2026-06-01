import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useTheme } from "@/lib/useTheme";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, parseISO } from "date-fns";
import { enUS, fi as fiFns } from "date-fns/locale";
import {
  LayoutDashboard, Calendar, Camera, Image, FileText,
  GraduationCap, Settings, ChevronLeft, ChevronRight,
  Download, ExternalLink, Copy, Check, Bell, BellOff,
  Play, Search, Moon, Sun, Eye, EyeOff, KeyRound,
  TrendingUp, Clock, MapPin, Instagram, Youtube,
} from "lucide-react";
import { toast } from "sonner";

// ── Translations ──────────────────────────────────────────────────────────────
const TR = {
  en: {
    home: "Home", calendar: "Calendar", shootings: "Shootings",
    content: "Content", documents: "Documents", tutorials: "Tutorials", admin: "Admin",
    hello: "Hello", welcome: "Welcome to your Unchain Studio client space.",
    todayPost: (n) => `You have ${n} post${n > 1 ? 's' : ''} to publish today`,
    upcomingShootings: "Upcoming shootings", noShootings: "No shootings scheduled",
    notifTitle: "Posting reminders", notifDesc: "Get a daily alert for content scheduled today.",
    notifOn: "Enabled", notifOff: "Enable",
    postToday: "Post today", postsThisMonth: "Posts this month",
    nextShooting: "Next shooting", noNextShooting: "No upcoming shooting",
    calendarPdf: "Calendar PDF", schedulePdf: "Production Schedule",
    copyCaption: "Copy caption", download: "Download",
    noContent: "No content found", noDocuments: "No documents shared yet",
    noTutorials: "No tutorials yet", noContracts: "No contracts",
    searchTutorials: "Search tutorials…", searchCredentials: "Search…",
    contracts: "Contracts", credentials: "Access & passwords",
    showMore: "Show more", showLess: "Show less",
    copied: "Copied", copyLogin: "Copy", copyPwd: "Copy",
    openLogin: "Login",
    past: "Past", upcoming: "Upcoming",
    all: "All", total: "total",
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri",
  },
  fi: {
    home: "Koti", calendar: "Kalenteri", shootings: "Kuvaukset",
    content: "Sisältö", documents: "Dokumentit", tutorials: "Oppaat", admin: "Hallinta",
    hello: "Hei", welcome: "Tervetuloa Unchain Studio -asiakastilaasi.",
    todayPost: (n) => `Sinulla on ${n} julkaistava${n > 1 ? '' : ''} sisältö tänään`,
    upcomingShootings: "Tulevat kuvaukset", noShootings: "Ei tulevia kuvauksia",
    notifTitle: "Julkaisumuistutukset", notifDesc: "Saat päivittäisen ilmoituksen tänään aikataulutetuista sisällöistä.",
    notifOn: "Käytössä", notifOff: "Ota käyttöön",
    postToday: "Julkaise tänään", postsThisMonth: "Julkaisut tässä kuussa",
    nextShooting: "Seuraava kuvaus", noNextShooting: "Ei tulevia kuvauksia",
    calendarPdf: "Kalenteri PDF", schedulePdf: "Tuotantoaikataulu",
    copyCaption: "Kopioi kuvateksti", download: "Lataa",
    noContent: "Sisältöä ei löydy", noDocuments: "Ei jaettuja dokumentteja",
    noTutorials: "Ei oppaita vielä", noContracts: "Ei sopimuksia",
    searchTutorials: "Hae oppaita…", searchCredentials: "Hae…",
    contracts: "Sopimukset", credentials: "Käyttöoikeudet & salasanat",
    showMore: "Näytä enemmän", showLess: "Näytä vähemmän",
    copied: "Kopioitu", copyLogin: "Kopioi", copyPwd: "Kopioi",
    openLogin: "Kirjaudu",
    past: "Menneet", upcoming: "Tulevat",
    all: "Kaikki", total: "yhteensä",
    mon: "Ma", tue: "Ti", wed: "Ke", thu: "To", fri: "Pe",
  },
};

// ── Push helpers ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = 'BEJ8xUeXYtAfm7W36wbzHvxBvczopyE_lRKQIezMB7-dR6LPvWf5LesbrjmXXcQrCA7GLQmMYk66y6UGUjOdFMI';

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Ensure SW is registered (portal may be opened directly without main app)
async function ensureSW() {
  if (!('serviceWorker' in navigator)) return null;
  // If already registered, return it
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  // Register from portal
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch { return null; }
}

async function getSwReg() {
  const reg = await ensureSW();
  if (!reg) return null;
  // Wait up to 5s for SW to activate
  if (reg.active) return reg;
  return new Promise((resolve) => {
    const sw = reg.installing || reg.waiting;
    if (!sw) { resolve(reg); return; }
    const timer = setTimeout(() => resolve(reg), 5000);
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') { clearTimeout(timer); resolve(reg); }
    });
  });
}

async function subscribePush(clientId, portalUrl) {
  if (!('PushManager' in window)) throw new Error('push_unsupported');
  if (!('Notification' in window)) throw new Error('push_unsupported');

  // iOS PWA check
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isIos && !isStandalone) throw new Error('ios_install');

  const perm = await Notification.requestPermission();
  if (perm === 'denied') throw new Error('push_denied');
  if (perm !== 'granted') return null;

  const reg = await getSwReg();
  if (!reg) throw new Error('sw_unavailable');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const j = sub.toJSON();
  await base44.functions.invoke('registerClientPush', {
    client_id: clientId,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    portal_url: portalUrl,
  }).catch(() => {});
  return sub;
}

async function unsubscribePush(clientId) {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) {
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (sub) {
      await base44.functions.invoke('registerClientPush', {
        client_id: clientId, endpoint: sub.endpoint, unsubscribe: true,
      }).catch(() => {});
      await sub.unsubscribe();
    }
  }
}

async function getPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

// ── Palette ───────────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post:     "bg-blue-100 text-blue-700",
};

function fmtDate(d, fmt, locale) {
  try { return format(typeof d === 'string' ? parseISO(d) : d, fmt, { locale }); }
  catch { return ''; }
}

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border"
      style={{ borderColor: 'var(--divider)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer' }}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? '✓' : label}
    </button>
  );
}

// ── Rotating greetings ────────────────────────────────────────────────────────
const GREETINGS_EN = [
  (name) => `Good to see you, ${name}.`,
  (name) => `Welcome back, ${name}.`,
  (name) => `Hello, ${name}! Here's your overview.`,
  (name) => `Hi ${name}, your content is ready.`,
  (name) => `Everything's in order, ${name}.`,
];
const GREETINGS_FI = [
  (name) => `Hienoa nähdä sinut, ${name}.`,
  (name) => `Tervetuloa takaisin, ${name}.`,
  (name) => `Hei ${name}! Tässä yhteenveto.`,
  (name) => `Hei ${name}, sisältösi on valmis.`,
  (name) => `Kaikki kunnossa, ${name}.`,
];

function getGreeting(lang, name) {
  const list = lang === 'fi' ? GREETINGS_FI : GREETINGS_EN;
  const idx = new Date().getDay() % list.length;
  return list[idx](name);
}

// ── Home (Bento) ──────────────────────────────────────────────────────────────
function HomeTab({ client = {}, content = [], shootings = [], pushSubscribed, onTogglePush, onTabChange, tr, dateLocale, lang }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thisMonth = format(new Date(), 'yyyy-MM');
  const monthPosts = content.filter(c => c.scheduled_date?.startsWith(thisMonth));
  const nextShooting = shootings.filter(s => s.date >= today)[0];
  const calPdfs = client.editorial_calendar_pdfs || [];

  // Mini calendar — current month, read-only dots
  const monthStart = startOfMonth(new Date());
  const monthEnd   = endOfMonth(new Date());
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad   = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;
  const calDays    = [...Array(startPad).fill(null), ...days];
  const contentByDay = {};
  content.forEach(c => {
    if (!c.scheduled_date) return;
    const k = c.scheduled_date.split('T')[0];
    if (!contentByDay[k]) contentByDay[k] = [];
    contentByDay[k].push(c);
  });

  const greeting = getGreeting(lang, client.company_name || '');

  return (
    <div className="space-y-3">

      {/* Greeting — small, subtle */}
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '4px 0' }}>
        {greeting}
      </p>

    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto' }}>

      {/* Content Bank — large card */}
      <div className="rounded-2xl p-5 cursor-pointer flex flex-col justify-between"
        style={{ gridColumn: 'span 2', background: 'var(--brand)', color: '#fff', boxShadow: 'var(--card-shadow)', minHeight: 140 }}
        onClick={() => onTabChange('content')}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Image size={16} style={{ opacity: 0.8 }} />
            <span className="text-xs font-mono uppercase tracking-wider" style={{ opacity: 0.75 }}>Content Bank</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
            {content.length} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>items</span>
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-3">
          {['Reel','Story','Carousel','Post'].map(t => {
            const n = content.filter(c => c.post_type === t).length;
            if (!n) return null;
            return <span key={t} className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>{n} {t}</span>;
          })}
        </div>
      </div>

      {/* Posts this month */}
      <div className="rounded-2xl p-4 cursor-pointer flex flex-col justify-between"
        style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)', minHeight: 140 }}
        onClick={() => onTabChange('calendar')}>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr.postsThisMonth}</p>
        <p style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)', lineHeight: 1 }}>{monthPosts.length}</p>
        <div className="flex gap-1 flex-wrap">
          {['Reel','Story','Carousel','Post'].map(t => {
            const n = monthPosts.filter(c => c.post_type === t).length;
            if (!n) return null;
            return <span key={t} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLOR[t]}`}>{n} {t}</span>;
          })}
        </div>
      </div>

      {/* Next shooting */}
      <div className="rounded-2xl p-4 cursor-pointer flex flex-col justify-between"
        style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)', minHeight: 140 }}
        onClick={() => onTabChange('shootings')}>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr.nextShooting}</p>
        {nextShooting ? (
          <div>
            <p className="text-sm font-bold truncate mt-1" style={{ color: 'var(--ink)' }}>{nextShooting.title}</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--brand)' }}>{fmtDate(nextShooting.date, 'd MMM', dateLocale)}{nextShooting.time ? ` · ${nextShooting.time}` : ''}</p>
            {nextShooting.location && <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}><MapPin className="w-3 h-3" />{nextShooting.location}</p>}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{tr.noNextShooting}</p>
        )}
        <Camera size={18} style={{ color: 'var(--brand)', marginTop: 8, opacity: 0.5 }} />
      </div>

      {/* Mini calendar preview */}
      <div className="rounded-2xl p-4 cursor-pointer overflow-hidden"
        style={{ gridColumn: 'span 3', background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}
        onClick={() => onTabChange('calendar')}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{fmtDate(new Date(), 'MMMM yyyy', dateLocale)}</p>
          <Calendar size={14} style={{ color: 'var(--muted)' }} />
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="text-center text-[9px] font-mono pb-1" style={{ color: 'var(--muted)' }}>{d}</div>
          ))}
          {calDays.map((day, i) => {
            if (!day) return <div key={`p-${i}`} />;
            const k = format(day, 'yyyy-MM-dd');
            const has = (contentByDay[k] || []).length > 0;
            const isToday = isSameDay(day, new Date());
            return (
              <div key={k} className="flex items-center justify-center" style={{ height: 28 }}>
                <div className="flex items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ width: 24, height: 24, background: isToday ? 'var(--brand)' : has ? 'var(--brand-muted)' : 'transparent', color: isToday ? '#fff' : has ? 'var(--brand)' : 'var(--subtle)', fontWeight: has || isToday ? 700 : 400 }}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Push notification — compact */}
      <div className="rounded-2xl p-3 flex flex-col justify-between"
        style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{tr.notifTitle}</p>
          <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--muted)' }}>{tr.notifDesc}</p>
        </div>
        <button onClick={onTogglePush}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
          style={{ background: pushSubscribed ? 'var(--brand)' : 'var(--bg)', color: pushSubscribed ? '#fff' : 'var(--ink)', border: '1px solid var(--divider)', cursor: 'pointer' }}>
          {pushSubscribed ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {pushSubscribed ? tr.notifOn : tr.notifOff}
        </button>
      </div>

    </div>
    </div>
  );
}

// ── Calendar tab ──────────────────────────────────────────────────────────────
function CalendarTab({ content = [], calendarPdfs = [], tr, dateLocale }) {
  const { dark } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(currentDate);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad   = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;
  const calDays7   = [...Array(startPad).fill(null), ...days];
  while (calDays7.length % 7 !== 0) calDays7.push(null);
  const calWeeks = [];
  for (let i = 0; i < calDays7.length; i += 7) calWeeks.push(calDays7.slice(i, i + 7));
  const calDays5 = calWeeks.flatMap(w => w.slice(0, 5));

  const contentByDay = {};
  content.forEach(c => {
    if (!c.scheduled_date) return;
    const key = c.scheduled_date.split('T')[0];
    if (!contentByDay[key]) contentByDay[key] = [];
    contentByDay[key].push(c);
  });
  const monthContent = content.filter(c => c.scheduled_date?.startsWith(format(currentDate, 'yyyy-MM')));
  const WEEKDAYS = [tr.mon, tr.tue, tr.wed, tr.thu, tr.fri];

  return (
    <div className="space-y-4">
      {calendarPdfs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {calendarPdfs.map((p, i) => {
            const url = typeof p === 'string' ? p : p.url;
            const label = typeof p === 'object' && p.month ? fmtDate(p.month + '-01', 'MMM yyyy', dateLocale) : `${tr.calendarPdf} ${calendarPdfs.length > 1 ? i + 1 : ''}`;
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold"
                style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
                <Download className="w-3.5 h-3.5" />{label}
              </a>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => setCurrentDate(d => subMonths(d, 1))}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
          {fmtDate(currentDate, 'MMMM yyyy', dateLocale)}
        </span>
        <button onClick={() => setCurrentDate(d => addMonths(d, 1))}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['Reel','Story','Carousel','Post'].map(t => {
          const count = monthContent.filter(c => c.post_type === t).length;
          if (!count) return null;
          return <span key={t} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${TYPE_COLOR[t] || 'bg-slate-100 text-slate-500'}`}>{count} {t}{count > 1 ? 's' : ''}</span>;
        })}
        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">{monthContent.length} {tr.total}</span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
        <div className="hidden sm:block">
          <div className="grid grid-cols-5" style={{ borderBottom: '1px solid var(--divider)' }}>
            {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] font-mono py-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-5">
            {calDays5.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} style={{ borderBottom: '1px solid var(--divider)', borderRight: '1px solid var(--divider)', background: dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)', minHeight: 100, padding: 4 }} />;
              const key = format(day, 'yyyy-MM-dd');
              const items = contentByDay[key] || [];
              const isToday = isSameDay(day, new Date());
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--divider)', borderRight: '1px solid var(--divider)', background: isToday ? (dark ? 'rgba(77,142,255,0.08)' : 'rgba(42,105,255,0.04)') : 'transparent', minHeight: 100, padding: '6px' }}>
                  <span className={`text-[11px] font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full mb-1 ${isToday ? 'bg-[#2A69FF] text-white' : ''}`} style={!isToday ? { color: 'var(--muted)' } : {}}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map(c => (
                      <div key={c.id} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate ${TYPE_COLOR[c.post_type] || 'bg-slate-100 text-slate-500'}`}>{c.title || c.post_type}</div>
                    ))}
                    {items.length > 3 && <div className="text-[9px] px-1" style={{ color: 'var(--muted)' }}>+{items.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--divider)' }}>
          {monthContent.length === 0
            ? <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>{tr.noContent}</p>
            : monthContent.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${TYPE_COLOR[c.post_type] || 'bg-slate-100 text-slate-500'}`}>{c.post_type}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{c.title}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmtDate(c.scheduled_date, 'd MMM', dateLocale)} · {c.platform}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Shootings tab ─────────────────────────────────────────────────────────────
function ShootingsTab({ shootings = [], tr, dateLocale }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = shootings.filter(s => s.date >= today);
  const past     = shootings.filter(s => s.date < today);

  const ShootingCard = ({ s }) => (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
          <Camera className="w-4 h-4" style={{ color: 'var(--brand)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>{s.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {fmtDate(s.date, 'd MMMM yyyy', dateLocale)}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}
          </p>
          {s.description && <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>{s.description}</p>}
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: 'var(--bg)', border: '1px solid var(--divider)', color: 'var(--muted)' }}>{s.status}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>{tr.noShootings}</p>
      )}
      {upcoming.length > 0 && (
        <><p className="text-label-mono">{tr.upcoming}</p>
        <div className="space-y-3">{upcoming.map(s => <ShootingCard key={s.id} s={s} />)}</div></>
      )}
      {past.length > 0 && (
        <><p className="text-label-mono mt-4">{tr.past}</p>
        <div className="space-y-3">{past.map(s => <ShootingCard key={s.id} s={s} />)}</div></>
      )}
    </div>
  );
}

// ── Content Bank tab ──────────────────────────────────────────────────────────
function ContentBankTab({ content = [], tr, dateLocale }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = content.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.platform?.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || c.post_type === filter;
    return matchSearch && matchFilter;
  });

  const groups = {};
  filtered.forEach(c => {
    const key = c.scheduled_date ? c.scheduled_date.substring(0, 7) : 'undated';
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)', outline: 'none' }} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)' }}>
          <option value="all">{tr.all}</option>
          {['Reel','Story','Carousel','Post'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {sortedKeys.length === 0 && <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>{tr.noContent}</p>}

      {sortedKeys.map(key => (
        <div key={key} className="space-y-2">
          <p className="text-label-mono" style={{ textTransform: 'capitalize' }}>
            {key === 'undated' ? '—' : fmtDate(key + '-01', 'MMMM yyyy', dateLocale)}
          </p>
          {groups[key].map(c => <ContentCard key={c.id} c={c} tr={tr} dateLocale={dateLocale} />)}
        </div>
      ))}
    </div>
  );
}

function ContentCard({ c, tr, dateLocale }) {
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const caption = c.reel_description || c.description || '';
  const LIMIT = 120;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
      {c.cover_image_url && (
        <div className="w-full aspect-video bg-slate-100 overflow-hidden">
          <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3 space-y-2.5">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>{c.title || '—'}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {c.post_type && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[c.post_type] || 'bg-slate-100 text-slate-500'}`}>{c.post_type}</span>}
            {c.platform && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.platform}</span>}
            {c.scheduled_date && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmtDate(c.scheduled_date, 'd MMM yyyy', dateLocale)}</span>}
          </div>
        </div>
        {caption && (
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)', whiteSpace: 'pre-wrap' }}>
              {captionExpanded || caption.length <= LIMIT ? caption : caption.slice(0, LIMIT) + '…'}
            </p>
            {caption.length > LIMIT && (
              <button onClick={() => setCaptionExpanded(e => !e)} className="text-xs mt-0.5" style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {captionExpanded ? tr.showLess : tr.showMore}
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {caption && <CopyButton value={caption} label={tr.copyCaption} />}
          {c.drive_url && (
            <a href={c.drive_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-semibold"
              style={{ borderColor: 'var(--brand)', background: 'var(--brand-muted)', color: 'var(--brand)', textDecoration: 'none' }}>
              <Download className="w-3.5 h-3.5" />{tr.download}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ client = {}, documents = [], tr, dateLocale }) {
  const schedulePdfs = client.production_schedule_pdfs || [];

  const openDoc = async (path) => {
    try {
      const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch { toast.error("Cannot open file"); }
  };

  return (
    <div className="space-y-5">
      {schedulePdfs.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-mono">{tr.schedulePdf}</p>
          <div className="flex gap-2 flex-wrap">
            {schedulePdfs.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold"
                style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
                <Download className="w-4 h-4" />{tr.schedulePdf} {schedulePdfs.length > 1 ? i + 1 : ''}
              </a>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-mono">Documents</p>
          <ul className="space-y-2">
            {documents.map(d => {
              const files = Array.isArray(d.files) ? d.files : [];
              return (
                <li key={d.id} className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                      <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{d.title}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(d.created_at, 'd MMM yyyy', dateLocale)} · {files.length} file{files.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {files.map(f => (
                        <button key={f.path} onClick={() => openDoc(f.path)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border"
                          style={{ borderColor: 'var(--divider)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--ink)' }}>
                          <Download className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {schedulePdfs.length === 0 && documents.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>{tr.noDocuments}</p>
      )}
    </div>
  );
}

// ── Tutorials tab ─────────────────────────────────────────────────────────────
function TutorialsTab({ tutorials = [], trainingPdfUrl, tr }) {
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(null);

  function getYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^?&\s]+)/);
    return m?.[1] || null;
  }

  const filtered = tutorials.filter(t => {
    const q = search.toLowerCase();
    return !q || t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {trainingPdfUrl && (
        <a href={trainingPdfUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
          <FileText className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Training guide</p>
            <p className="text-xs opacity-80">Download the full training PDF</p>
          </div>
          <Download className="w-4 h-4 shrink-0" />
        </a>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr.searchTutorials}
          className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)', outline: 'none' }} />
      </div>

      {filtered.length === 0 && <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>{tr.noTutorials}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map(t => {
          const ytId = getYouTubeId(t.youtube_url || t.video_url);
          const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : t.thumbnail_url;
          const isPlaying = playing === t.id;
          return (
            <div key={t.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
              {thumb && !isPlaying && (
                <button onClick={() => setPlaying(t.id)} className="relative w-full block" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <img src={thumb} alt={t.title} className="w-full aspect-video object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-slate-800 ml-1" />
                    </div>
                  </div>
                </button>
              )}
              {isPlaying && ytId && (
                <div className="aspect-video">
                  <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} className="w-full h-full" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen title={t.title} />
                </div>
              )}
              <div className="p-3">
                {t.category && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.category}</span>}
                <p className="text-sm font-semibold mt-1" style={{ color: 'var(--ink)' }}>{t.title}</p>
                {t.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{t.description}</p>}
                {!thumb && !isPlaying && (t.youtube_url || t.video_url) && (
                  <a href={t.youtube_url || t.video_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--brand)' }}>
                    <ExternalLink className="w-3.5 h-3.5" /> Watch
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin tab ─────────────────────────────────────────────────────────────────
function AdminTab({ client = {}, contracts = [], credentials = [], tr, dateLocale }) {
  const [showPwd, setShowPwd] = useState({});
  const [search, setSearch] = useState('');

  const filteredCreds = credentials.filter(c => {
    const q = search.toLowerCase();
    return !q || c.label?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-label-mono">{tr.contracts}</p>
        {contracts.length === 0
          ? <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>{tr.noContracts}</p>
          : contracts.map(c => (
            <div key={c.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{c.title || 'Contract'}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {c.status}{c.amount ? ` · ${c.amount} ${c.currency || ''}` : ''}{c.start_date ? ` · ${fmtDate(c.start_date, 'd MMM yyyy', dateLocale)}` : ''}
                </p>
              </div>
              {(client.contract_documents || []).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center' }}>
                  <Download className="w-4 h-4" />
                </a>
              ))}
            </div>
          ))
        }
      </div>

      {credentials.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-mono">{tr.credentials}</p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr.searchCredentials}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)', outline: 'none' }} />
          </div>
          <ul className="space-y-2">
            {filteredCreds.map(cred => (
              <li key={cred.id} className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                    <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{cred.label}</p>
                      {cred.category && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{cred.category}</span>}
                    </div>
                    {cred.username && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{cred.username}</span>
                        <CopyButton value={cred.username} label={tr.copyLogin} />
                      </div>
                    )}
                    {cred.password && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: 'var(--subtle)' }}>
                          {showPwd[cred.id] ? cred.password : '••••••••'}
                        </span>
                        <button onClick={() => setShowPwd(m => ({ ...m, [cred.id]: !m[cred.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)', display: 'flex' }}>
                          {showPwd[cred.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <CopyButton value={cred.password} label={tr.copyPwd} />
                      </div>
                    )}
                    {cred.login_url && (
                      <a href={cred.login_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--brand)' }}>
                        <ExternalLink className="w-3 h-3" /> {tr.openLogin}
                      </a>
                    )}
                    {cred.notes && <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>{cred.notes}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main portal ───────────────────────────────────────────────────────────────
export default function ClientPortalV2() {
  const { token } = useParams();
  const { dark, toggle: toggleDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getClientPortalV2Data', { token });
        if (res.error) throw new Error(res.error);
        setData(res);
      } catch (e) {
        setError(e.message || 'Invalid or expired link');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    getPushSubscribed().then(setPushSubscribed);
  }, []);

  const lang = data?.client?.default_language || 'en';
  const tr = TR[lang] || TR.en;
  const dateLocale = lang === 'fi' ? fiFns : enUS;

  const {
    client = {},
    content = [],
    shootings = [],
    contracts = [],
    documents = [],
    tutorials = [],
    credentials = [],
  } = data || {};

  const portalUrl = `${window.location.origin}/portal/${token}`;

  const handleTogglePush = async () => {
    if (!client?.id) return;
    try {
      if (pushSubscribed) {
        await unsubscribePush(client.id);
        setPushSubscribed(false);
        toast.success(lang === 'fi' ? 'Ilmoitukset poistettu käytöstä' : 'Notifications disabled');
      } else {
        const sub = await subscribePush(client.id, portalUrl);
        if (sub) {
          setPushSubscribed(true);
          toast.success(lang === 'fi' ? 'Ilmoitukset otettu käyttöön! 🔔' : 'Notifications enabled! 🔔');
        }
      }
    } catch (e) {
      if (e.message === 'ios_install') {
        toast(lang === 'fi'
          ? 'Lisää sivu kotinäyttöön Safarissa ottaaksesi ilmoitukset käyttöön.'
          : 'Add this page to your Home Screen in Safari to enable notifications.', { duration: 6000 });
      } else if (e.message === 'push_denied') {
        toast.error(lang === 'fi'
          ? 'Ilmoitukset on estetty — salli ne selaimen asetuksissa.'
          : 'Notifications blocked — allow them in your browser settings.');
      } else if (e.message === 'push_unsupported') {
        toast.error(lang === 'fi' ? 'Selaimesi ei tue push-ilmoituksia.' : 'Your browser does not support push notifications.');
      } else if (e.message === 'sw_unavailable') {
        toast.error(lang === 'fi' ? 'Service worker ei ole käytettävissä.' : 'Service worker unavailable. Try reloading the page.');
      } else {
        toast.error(e.message);
      }
    }
  };

  const TABS = [
    { key: 'home',      label: tr.home,      icon: LayoutDashboard },
    { key: 'calendar',  label: tr.calendar,  icon: Calendar },
    { key: 'shootings', label: tr.shootings, icon: Camera },
    { key: 'content',   label: tr.content,   icon: Image },
    { key: 'documents', label: tr.documents, icon: FileText },
    { key: 'tutorials', label: tr.tutorials, icon: GraduationCap },
    { key: 'admin',     label: tr.admin,     icon: Settings },
  ];

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: 'var(--divider)', borderTopColor: 'var(--ink)' }} />
    </div>
  );

  if (error || !data) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <p style={{ fontSize: 20, fontWeight: 800 }}>Invalid link</p>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>{error || 'This link is not valid.'}</p>
    </div>
  );

  const MOBILE_TABS = TABS.slice(0, 4); // home, calendar, shootings, content
  const MORE_TABS   = TABS.slice(4);    // documents, tutorials, admin
  const moreActive  = MORE_TABS.some(t => t.key === activeTab);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      {/* Topbar */}
      <div style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', paddingBottom: 16 }}>
        <div className="mx-auto flex items-center justify-between gap-4 px-5" style={{ maxWidth: 1400 }}>
          <div className="flex items-center gap-2.5 shrink-0">
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>U</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.2px' }}>Unchain Studio</span>
          </div>

          {/* Desktop tabs */}
          <div className="hidden md:flex items-center gap-1 p-1" style={{ background: 'var(--card)', borderRadius: 'var(--pill-radius)', boxShadow: 'var(--card-shadow)', border: '1px solid var(--divider)' }}>
            {TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, transition: 'all 150ms', background: active ? 'var(--brand)' : 'transparent', color: active ? '#fff' : 'var(--muted)' }}>
                  <Icon size={14} />{t.label}
                </button>
              );
            })}
          </div>

          <button onClick={toggleDark}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            {dark ? <Sun size={16} style={{ color: 'var(--muted)' }} /> : <Moon size={16} style={{ color: 'var(--muted)' }} />}
          </button>
        </div>
      </div>

      {/* Page header (non-home) */}
      {activeTab !== 'home' && (
        <div className="mx-auto px-5" style={{ maxWidth: 1400, paddingBottom: 12 }}>
          {(() => { const t = TABS.find(x => x.key === activeTab); if (!t) return null; const Icon = t.icon; return (
            <div className="flex items-center gap-2">
              <Icon size={18} style={{ color: 'var(--brand)' }} />
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{t.label}</h1>
            </div>
          ); })()}
        </div>
      )}

      {/* Content */}
      <div className="mx-auto px-5" style={{ maxWidth: 1400, paddingBottom: 120 }}>
        {activeTab === 'home'      && <HomeTab client={client} content={content} shootings={shootings} pushSubscribed={pushSubscribed} onTogglePush={handleTogglePush} onTabChange={setActiveTab} tr={tr} dateLocale={dateLocale} lang={lang} />}
        {activeTab === 'calendar'  && <CalendarTab content={content} calendarPdfs={client.editorial_calendar_pdfs || []} tr={tr} dateLocale={dateLocale} />}
        {activeTab === 'shootings' && <ShootingsTab shootings={shootings} tr={tr} dateLocale={dateLocale} />}
        {activeTab === 'content'   && <ContentBankTab content={content} tr={tr} dateLocale={dateLocale} />}
        {activeTab === 'documents' && <DocumentsTab client={client} documents={documents} tr={tr} dateLocale={dateLocale} />}
        {activeTab === 'tutorials' && <TutorialsTab tutorials={tutorials} trainingPdfUrl={client.training_pdf_url} tr={tr} />}
        {activeTab === 'admin'     && <AdminTab client={client} contracts={contracts} credentials={credentials} tr={tr} dateLocale={dateLocale} />}
      </div>

      {/* Mobile — More drawer */}
      {moreOpen && (
        <>
          <div className="md:hidden fixed inset-0" style={{ zIndex: 48 }} onClick={() => setMoreOpen(false)} />
          <div className="md:hidden fixed bottom-16 left-0 right-0 mx-3 rounded-2xl overflow-hidden"
            style={{ zIndex: 49, background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', paddingBottom: 4 }}>
            {MORE_TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button key={t.key}
                  onClick={() => { setActiveTab(t.key); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3"
                  style={{ background: active ? 'var(--brand-muted)' : 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--brand)' : 'var(--ink)', textAlign: 'left' }}>
                  <Icon size={18} />
                  <span style={{ fontSize: 14, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: 'var(--card)', borderTop: '1px solid var(--divider)', zIndex: 50 }}>
        <div className="flex">
          {MOBILE_TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => { setActiveTab(t.key); setMoreOpen(false); }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--brand)' : 'var(--muted)' }}>
                <Icon size={20} />
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{t.label}</span>
              </button>
            );
          })}
          {/* More button */}
          <button onClick={() => setMoreOpen(o => !o)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: moreActive || moreOpen ? 'var(--brand)' : 'var(--muted)' }}>
            <Settings size={20} />
            <span style={{ fontSize: 9, fontWeight: moreActive || moreOpen ? 700 : 500 }}>More</span>
          </button>
        </div>
      </div>
    </div>
  );
}
