import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAdmin } from '../_shared/auth.ts';

// ── Finnish public holiday helpers ────────────────────────────────────────────

/** Meeus/Jones/Butcher algorithm — returns Easter Sunday as [month (1-based), day] */
function easterDate(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

/** Returns Set of ISO date strings (yyyy-MM-dd) that are Finnish public holidays for a given year */
function finnishHolidays(year: number): Set<string> {
  const fmt = (m: number, d: number) =>
    `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const holidays = new Set<string>([
    fmt(1, 1),   // New Year
    fmt(1, 6),   // Epiphany
    fmt(5, 1),   // May Day
    fmt(12, 6),  // Independence Day
    fmt(12, 24), // Christmas Eve
    fmt(12, 25), // Christmas Day
    fmt(12, 26), // Boxing Day
  ]);

  // Easter-based holidays
  const [easterM, easterD] = easterDate(year);
  const easter = new Date(year, easterM - 1, easterD);

  const addOffset = (base: Date, offsetDays: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offsetDays);
    return d;
  };
  const isoStr = (d: Date) => d.toISOString().slice(0, 10);

  holidays.add(isoStr(addOffset(easter, -2)));  // Good Friday
  holidays.add(isoStr(easter));                  // Easter Sunday
  holidays.add(isoStr(addOffset(easter, 1)));    // Easter Monday
  holidays.add(isoStr(addOffset(easter, 39)));   // Ascension Thursday
  holidays.add(isoStr(addOffset(easter, 49)));   // Whit Sunday

  // Midsummer Eve: Friday between June 19–25
  for (let d = 19; d <= 25; d++) {
    const dt = new Date(year, 5, d); // June
    if (dt.getDay() === 5) { holidays.add(fmt(6, d)); break; }
  }
  // Midsummer Day: Saturday between June 20–26
  for (let d = 20; d <= 26; d++) {
    const dt = new Date(year, 5, d);
    if (dt.getDay() === 6) { holidays.add(fmt(6, d)); break; }
  }

  // All Saints' Day: Saturday between Oct 31 – Nov 6
  for (let d = 31; d <= 37; d++) {
    const dt = new Date(year, d >= 32 ? 10 : 9, d >= 32 ? d - 31 : d);
    if (dt.getDay() === 6) {
      holidays.add(isoStr(dt));
      break;
    }
  }

  return holidays;
}

/** Bump a date forward past weekends and Finnish holidays */
function nextWorkingDay(date: Date, holidays: Set<string>): Date {
  const d = new Date(date);
  while (true) {
    const day = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(iso)) return d;
    d.setDate(d.getDate() + 1);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Allow invocation from cron (no user auth) or from admin users
    const authHeader = req.headers.get('Authorization') || '';
    const isCronCall = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '__never__');

    if (!isCronCall) {
      const adminResult = await verifyAdmin(req, supabaseAdmin);
      if (adminResult instanceof Response) return adminResult;
    }

    const body = await req.json().catch(() => ({}));
    const { month: rawMonth, dry_run = false } = body as { month?: string; dry_run?: boolean };

    // Default to current month
    const now = new Date();
    const month = rawMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10); // 1-based

    // Idempotency: skip if tasks already exist for this month
    const { count: existing } = await supabaseAdmin
      .from('workflow_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('month', month);

    if ((existing || 0) > 0 && !dry_run) {
      return Response.json(
        { success: true, skipped: true, reason: `Tasks for ${month} already exist (${existing} rows)`, created: 0 },
        { headers: corsHeaders(req) },
      );
    }

    // ── Fetch active clients ──────────────────────────────────────────────────
    const { data: clients, error: clientsErr } = await supabaseAdmin
      .from('clients')
      .select('id, company_name')
      .eq('status', 'Actif');

    if (clientsErr) throw clientsErr;
    if (!clients?.length) {
      return Response.json({ success: true, created: 0, reason: 'No active clients' }, { headers: corsHeaders(req) });
    }

    // ── Fetch templates with a scheduled day ─────────────────────────────────
    const { data: templates, error: tplErr } = await supabaseAdmin
      .from('workflow_message_templates')
      .select('msg_id, default_day_of_month, default_channel, default_assigned_to')
      .not('default_day_of_month', 'is', null);

    if (tplErr) throw tplErr;
    if (!templates?.length) {
      return Response.json({ success: true, created: 0, reason: 'No schedulable templates' }, { headers: corsHeaders(req) });
    }

    // ── Resolve user IDs for assignees ───────────────────────────────────────
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();
    const anthonyUserId: string | null = adminProfile?.id || null;

    // For named freelancers, look up via the freelancers table (case-insensitive name match)
    const freelancerNameCache: Record<string, string | null> = {};

    async function resolveFreelancerUserId(name: string): Promise<string | null> {
      if (name === 'anthony') return anthonyUserId;
      if (name === 'auto') return null;
      if (name in freelancerNameCache) return freelancerNameCache[name];

      const { data: fl } = await supabaseAdmin
        .from('freelancers')
        .select('user_id')
        .ilike('name', `%${name}%`)
        .not('user_id', 'is', null)
        .limit(1)
        .single();

      const uid = fl?.user_id || null;
      freelancerNameCache[name] = uid;
      return uid;
    }

    // ── Build tasks ───────────────────────────────────────────────────────────
    const holidays = finnishHolidays(year);
    const rows: Record<string, unknown>[] = [];

    for (const client of clients) {
      for (const tpl of templates) {
        const day = tpl.default_day_of_month as number;
        const rawDate = new Date(year, monthNum - 1, day);
        const scheduledDate = nextWorkingDay(rawDate, holidays);
        const assignedTo = (tpl.default_assigned_to as string) || 'anthony';
        const assignedUserId = await resolveFreelancerUserId(assignedTo);

        rows.push({
          client_id: client.id,
          month,
          msg_id: tpl.msg_id,
          scheduled_date: scheduledDate.toISOString().slice(0, 10),
          channel: tpl.default_channel,
          status: 'pending',
          assigned_to: assignedTo,
          assigned_user_id: assignedUserId,
        });
      }
    }

    if (dry_run) {
      return Response.json({ success: true, dry_run: true, would_create: rows.length, month }, { headers: corsHeaders(req) });
    }

    // ── Insert ────────────────────────────────────────────────────────────────
    const CHUNK = 500;
    let totalCreated = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error: insertErr, count } = await supabaseAdmin
        .from('workflow_tasks')
        .insert(chunk, { count: 'exact' });
      if (insertErr) {
        console.error('[generateWorkflowTasks] insert error:', insertErr);
        throw insertErr;
      }
      totalCreated += count || chunk.length;
    }

    console.log(`[generateWorkflowTasks] month=${month} created=${totalCreated}`);
    return Response.json({ success: true, created: totalCreated, month }, { headers: corsHeaders(req) });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generateWorkflowTasks] CATCH:', msg);
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders(req) });
  }
});
