import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { base44, supabase } from "@/api/base44Client";
import { useTheme } from "@/lib/useTheme";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, parseISO, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LayoutDashboard, Calendar, Camera, Image, FileText,
  GraduationCap, Settings, ChevronLeft, ChevronRight,
  Download, ExternalLink, Copy, Check, Bell, BellOff,
  Play, Search, Moon, Sun, Eye, EyeOff, KeyRound
} from "lucide-react";
import { toast } from "sonner";

// ── Push helpers (token-based, no user auth) ─────────────────────────────────
const VAPID_PUBLIC_KEY = 'BEJ8xUeXYtAfm7W36wbzHvxBvczopyE_lRKQIezMB7-dR6LPvWf5LesbrjmXXcQrCA7GLQmMYk66y6UGUjOdFMI';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function subscribePush(clientId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
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
  }).catch(() => {});
  return sub;
}

async function unsubscribePush(clientId) {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await base44.functions.invoke('registerClientPush', {
      client_id: clientId,
      endpoint: sub.endpoint,
      unsubscribe: true,
    }).catch(() => {});
    await sub.unsubscribe();
  }
}

async function getPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

// ── Palette ───────────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  Reel:     "bg-pink-100 text-pink-700",
  Story:    "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post:     "bg-blue-100 text-blue-700",
};

const PLATFORM_COLOR = {
  Instagram: "bg-gradient-to-r from-pink-500 to-purple-500",
  TikTok:    "bg-black",
  Facebook:  "bg-blue-600",
  LinkedIn:  "bg-blue-700",
  YouTube:   "bg-red-600",
};

// ── Utility ───────────────────────────────────────────────────────────────────
function fmtDate(d, fmt, locale) {
  try { return format(typeof d === 'string' ? parseISO(d) : d, fmt, { locale }); }
  catch { return ''; }
}

function CopyButton({ value, label = "Copier" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border"
      style={{ borderColor: 'var(--divider)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer' }}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copié" : label}
    </button>
  );
}

// ── Home tab ──────────────────────────────────────────────────────────────────
function HomeTab({ client = {}, content = [], shootings = [], pushSubscribed, onTogglePush }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayPosts = content.filter(c => c.scheduled_date?.startsWith(today));
  const nextShootings = shootings
    .filter(s => s.date >= today)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)', border: '1px solid var(--divider)' }}>
        <p className="text-h2" style={{ marginBottom: 4 }}>Bonjour, {client.company_name} 👋</p>
        <p className="text-body-sm" style={{ color: 'var(--muted)' }}>Bienvenue dans votre espace client Unchain Studio.</p>
      </div>

      {todayPosts.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--brand)', color: '#fff' }}>
          <p className="font-semibold text-sm mb-1">📅 Vous avez {todayPosts.length} contenu{todayPosts.length > 1 ? 's' : ''} à poster aujourd'hui</p>
          <ul className="space-y-0.5">
            {todayPosts.map(c => (
              <li key={c.id} className="text-xs opacity-90">{c.title || c.post_type} — {c.platform}</li>
            ))}
          </ul>
        </div>
      )}

      {nextShootings.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-mono">Prochains shootings</p>
          {nextShootings.map(s => (
            <div key={s.id} className="rounded-xl p-3 flex gap-3 items-center" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                <Camera className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-h3 truncate">{s.title}</p>
                <p className="text-body-sm truncate" style={{ color: 'var(--muted)' }}>
                  {fmtDate(s.date, "d MMMM yyyy", fr)}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">Notifications de posting</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Recevez une alerte chaque matin pour les contenus à poster.
            </p>
          </div>
          <button onClick={onTogglePush}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: pushSubscribed ? 'var(--brand)' : 'var(--card)', color: pushSubscribed ? '#fff' : 'var(--ink)', border: '1px solid var(--divider)', cursor: 'pointer', flexShrink: 0 }}>
            {pushSubscribed ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            {pushSubscribed ? 'Activé' : 'Activer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar tab ──────────────────────────────────────────────────────────────
function CalendarTab({ content = [], calendarPdfs = [] }) {
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

  const monthContent = content.filter(c =>
    c.scheduled_date?.startsWith(format(currentDate, 'yyyy-MM'))
  );

  const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

  return (
    <div className="space-y-4">
      {calendarPdfs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {calendarPdfs.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold"
              style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
              <Download className="w-3.5 h-3.5" />
              Calendrier PDF {calendarPdfs.length > 1 ? i + 1 : ''}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setCurrentDate(d => subMonths(d, 1))}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
          {fmtDate(currentDate, 'MMMM yyyy', fr)}
        </span>
        <button onClick={() => setCurrentDate(d => addMonths(d, 1))}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted)' }} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['Reel', 'Story', 'Carousel', 'Post'].map(t => {
          const count = monthContent.filter(c => c.post_type === t).length;
          if (!count) return null;
          return <span key={t} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${TYPE_COLOR[t] || 'bg-slate-100 text-slate-500'}`}>{count} {t}{count > 1 ? 's' : ''}</span>;
        })}
        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">{monthContent.length} total</span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
        <div className="hidden sm:block">
          <div className="grid grid-cols-5" style={{ borderBottom: '1px solid var(--divider)' }}>
            {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] font-mono py-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-5">
            {calDays5.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} style={{ borderBottom: '1px solid var(--divider)', borderRight: '1px solid var(--divider)', background: dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)', minHeight: 110, padding: 4 }} />;
              const key = format(day, 'yyyy-MM-dd');
              const items = contentByDay[key] || [];
              const isToday = isSameDay(day, new Date());
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--divider)', borderRight: '1px solid var(--divider)', background: isToday ? (dark ? 'rgba(77,142,255,0.08)' : 'rgba(42,105,255,0.04)') : 'transparent', minHeight: 110, padding: '6px' }}>
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
        {/* Mobile list fallback */}
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--divider)' }}>
          {monthContent.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Aucun contenu ce mois-ci</p>
          ) : monthContent.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${TYPE_COLOR[c.post_type] || 'bg-slate-100 text-slate-500'}`}>{c.post_type}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{c.title}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmtDate(c.scheduled_date, 'd MMM', fr)} · {c.platform}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shootings tab ─────────────────────────────────────────────────────────────
function ShootingsTab({ shootings = [] }) {
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
          <p className="text-h3">{s.title}</p>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            {fmtDate(s.date, 'd MMMM yyyy', fr)}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}
          </p>
          {s.description && <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>{s.description}</p>}
          {s.notes && <p className="text-xs mt-1 italic" style={{ color: 'var(--subtle)' }}>{s.notes}</p>}
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: 'var(--bg)', border: '1px solid var(--divider)', color: 'var(--muted)' }}>
          {s.status}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Aucun shooting</p>
      )}
      {upcoming.length > 0 && (
        <>
          <p className="text-label-mono">À venir</p>
          <div className="space-y-3">{upcoming.map(s => <ShootingCard key={s.id} s={s} />)}</div>
        </>
      )}
      {past.length > 0 && (
        <>
          <p className="text-label-mono mt-4">Passés</p>
          <div className="space-y-3">{past.map(s => <ShootingCard key={s.id} s={s} />)}</div>
        </>
      )}
    </div>
  );
}

// ── Content Bank tab ──────────────────────────────────────────────────────────
function ContentBankTab({ content = [] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = content.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.platform?.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || c.post_type === filter;
    return matchSearch && matchFilter;
  });

  // Group by month
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)', outline: 'none' }} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)' }}>
          <option value="all">Tous</option>
          {['Reel', 'Story', 'Carousel', 'Post'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {sortedKeys.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Aucun contenu trouvé</p>
      )}

      {sortedKeys.map(key => (
        <div key={key} className="space-y-2">
          <p className="text-label-mono" style={{ textTransform: 'capitalize' }}>
            {key === 'undated' ? 'Sans date' : fmtDate(key + '-01', 'MMMM yyyy', fr)}
          </p>
          {groups[key].map(c => <ContentCard key={c.id} c={c} />)}
        </div>
      ))}
    </div>
  );
}

function ContentCard({ c }) {
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const caption = c.reel_description || c.description || '';
  const CAPTION_LIMIT = 120;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--divider)', boxShadow: 'var(--card-shadow)' }}>
      {c.cover_image_url && (
        <div className="w-full aspect-video bg-slate-100 overflow-hidden">
          <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-h3 truncate">{c.title || '—'}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {c.post_type && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[c.post_type] || 'bg-slate-100 text-slate-500'}`}>{c.post_type}</span>}
              {c.platform && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.platform}</span>}
              {c.scheduled_date && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmtDate(c.scheduled_date, 'd MMM yyyy', fr)}</span>}
            </div>
          </div>
        </div>

        {caption && (
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)', whiteSpace: 'pre-wrap' }}>
              {captionExpanded || caption.length <= CAPTION_LIMIT ? caption : caption.slice(0, CAPTION_LIMIT) + '…'}
            </p>
            {caption.length > CAPTION_LIMIT && (
              <button onClick={() => setCaptionExpanded(e => !e)} className="text-xs mt-0.5" style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {captionExpanded ? 'Réduire' : 'Voir plus'}
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {caption && <CopyButton value={caption} label="Copier la légende" />}
          {c.drive_url && (
            <a href={c.drive_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-semibold"
              style={{ borderColor: 'var(--brand)', background: 'var(--brand-muted)', color: 'var(--brand)', textDecoration: 'none' }}>
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ client = {}, documents = [] }) {
  const schedulePdfs = client.production_schedule_pdfs || [];

  const openDoc = async (path) => {
    try {
      const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error("Impossible d'ouvrir le fichier");
    }
  };

  return (
    <div className="space-y-5">
      {schedulePdfs.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-mono">Planning de production</p>
          <div className="flex gap-2 flex-wrap">
            {schedulePdfs.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold"
                style={{ background: 'var(--brand)', color: '#fff', textDecoration: 'none' }}>
                <Download className="w-4 h-4" />
                Planning {schedulePdfs.length > 1 ? i + 1 : ''}
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
                <li key={d.id} className="rounded-2xl p-3" style={{ background: 'var(--card)', boxShadow: 'var(--card-shadow)', border: '1px solid var(--divider)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
                      <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-h3">{d.title}</p>
                      <p className="text-body-sm" style={{ color: 'var(--muted)' }}>{fmtDate(d.created_at, 'd MMM yyyy', fr)} · {files.length} fichier{files.length > 1 ? 's' : ''}</p>
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
        <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Aucun document partagé pour le moment</p>
      )}
    </div>
  );
}

// ── Tutorials tab ─────────────────────────────────────────────────────────────
function TutorialsTab({ tutorials = [], trainingPdfUrl }) {
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
          <div>
            <p className="font-semibold text-sm">Guide de formation</p>
            <p className="text-xs opacity-80">Télécharger le PDF de formation complète</p>
          </div>
          <Download className="w-4 h-4 ml-auto shrink-0" />
        </a>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une vidéo…"
          className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--divider)', background: 'var(--card)', color: 'var(--ink)', outline: 'none' }} />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Aucun tutoriel</p>
      )}

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
                <p className="text-h3 mt-1">{t.title}</p>
                {t.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{t.description}</p>}
                {!thumb && !isPlaying && (t.youtube_url || t.video_url) && (
                  <a href={t.youtube_url || t.video_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--brand)' }}>
                    <ExternalLink className="w-3.5 h-3.5" /> Voir la vidéo
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
function AdminTab({ client = {}, contracts = [], credentials = [] }) {
  const [showPwd, setShowPwd] = useState({});
  const [search, setSearch] = useState('');

  const filteredCreds = credentials.filter(c => {
    const q = search.toLowerCase();
    return !q || c.label?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Contracts */}
      <div className="space-y-2">
        <p className="text-label-mono">Contrats</p>
        {contracts.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>Aucun contrat</p>
        ) : contracts.map(c => (
          <div key={c.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--divider)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-muted)' }}>
              <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-h3 truncate">{c.title || 'Contrat'}</p>
              <p className="text-body-sm" style={{ color: 'var(--muted)' }}>
                {c.status} {c.amount ? `· ${c.amount} ${c.currency || ''}` : ''} {c.start_date ? `· ${fmtDate(c.start_date, 'd MMM yyyy', fr)}` : ''}
              </p>
            </div>
            {(client.contract_documents || []).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center' }}>
                <Download className="w-4 h-4" />
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Credentials */}
      {credentials.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-mono">Accès & mots de passe</p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
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
                    <div className="flex items-center gap-2">
                      <p className="text-h3 truncate">{cred.label}</p>
                      {cred.category && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{cred.category}</span>}
                    </div>
                    {cred.username && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{cred.username}</span>
                        <CopyButton value={cred.username} label="Copier" />
                      </div>
                    )}
                    {cred.password && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-mono" style={{ color: 'var(--subtle)' }}>
                          {showPwd[cred.id] ? cred.password : '••••••••'}
                        </span>
                        <button onClick={() => setShowPwd(m => ({ ...m, [cred.id]: !m[cred.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)', display: 'flex' }}>
                          {showPwd[cred.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <CopyButton value={cred.password} label="Copier" />
                      </div>
                    )}
                    {cred.login_url && (
                      <a href={cred.login_url} target="_blank" rel="noopener noreferrer" className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--brand)' }}>
                        <ExternalLink className="w-3 h-3" /> Se connecter
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
  const { dark, setDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [pushSubscribed, setPushSubscribed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getClientPortalV2Data', { token });
        if (res.error) throw new Error(res.error);
        setData(res);
      } catch (e) {
        setError(e.message || 'Lien invalide ou expiré');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    getPushSubscribed().then(setPushSubscribed);
  }, []);

  const handleTogglePush = async () => {
    if (!data?.client) return;
    try {
      if (pushSubscribed) {
        await unsubscribePush(data.client.id);
        setPushSubscribed(false);
        toast.success('Notifications désactivées');
      } else {
        const sub = await subscribePush(data.client.id);
        if (sub) { setPushSubscribed(true); toast.success('Notifications activées !'); }
        else toast.error('Impossible d\'activer les notifications. Vérifiez les permissions.');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const TABS = [
    { key: 'home',      label: 'Accueil',    icon: LayoutDashboard },
    { key: 'calendar',  label: 'Calendrier', icon: Calendar },
    { key: 'shootings', label: 'Shootings',  icon: Camera },
    { key: 'content',   label: 'Contenus',   icon: Image },
    { key: 'documents', label: 'Documents',  icon: FileText },
    { key: 'tutorials', label: 'Tutoriels',  icon: GraduationCap },
    { key: 'admin',     label: 'Admin',      icon: Settings },
  ];

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: 'var(--divider)', borderTopColor: 'var(--ink)' }} />
    </div>
  );

  if (error || !data) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <p className="text-h2">Accès invalide</p>
      <p className="text-body-sm" style={{ color: 'var(--muted)' }}>{error || 'Ce lien n\'est pas valide.'}</p>
    </div>
  );

  const {
    client = {},
    content = [],
    shootings = [],
    contracts = [],
    documents = [],
    tutorials = [],
    credentials = [],
  } = data || {};

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      {/* Topbar */}
      <div style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', paddingBottom: 16, paddingLeft: 20, paddingRight: 20 }}>
        <div className="flex items-center justify-between gap-4">
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
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Dark mode toggle */}
          <button onClick={() => setDark(!dark)}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--divider)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            {dark ? <Sun size={16} style={{ color: 'var(--muted)' }} /> : <Moon size={16} style={{ color: 'var(--muted)' }} />}
          </button>
        </div>
      </div>

      {/* Page header (non-dashboard) */}
      {activeTab !== 'home' && (
        <div style={{ padding: '0 20px 12px' }}>
          {(() => { const t = TABS.find(x => x.key === activeTab); if (!t) return null; const Icon = t.icon; return (
            <div className="flex items-center gap-2">
              <Icon size={18} style={{ color: 'var(--brand)' }} />
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{t.label}</h1>
            </div>
          ); })()}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '0 20px', paddingBottom: 120 }}>
        {activeTab === 'home'      && <HomeTab client={client} content={content} shootings={shootings} pushSubscribed={pushSubscribed} onTogglePush={handleTogglePush} />}
        {activeTab === 'calendar'  && <CalendarTab content={content} calendarPdfs={client.editorial_calendar_pdfs || []} />}
        {activeTab === 'shootings' && <ShootingsTab shootings={shootings} />}
        {activeTab === 'content'   && <ContentBankTab content={content} />}
        {activeTab === 'documents' && <DocumentsTab client={client} documents={documents} />}
        {activeTab === 'tutorials' && <TutorialsTab tutorials={tutorials} trainingPdfUrl={client.training_pdf_url} />}
        {activeTab === 'admin'     && <AdminTab client={client} contracts={contracts} credentials={credentials} />}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: 'var(--card)', borderTop: '1px solid var(--divider)', zIndex: 50 }}>
        <div className="flex">
          {TABS.slice(0, 5).map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--brand)' : 'var(--muted)' }}>
                <Icon size={20} />
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
        {/* More tabs (tutorials, admin) on mobile via secondary row or we just show 5 */}
      </div>
    </div>
  );
}
