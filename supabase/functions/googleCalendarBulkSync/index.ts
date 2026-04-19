import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function getValidAccessToken(userId: string): Promise<string | null> {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data } = await db
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (!data) return null;
  if (Date.now() < new Date(data.expires_at).getTime() - 60_000) return data.access_token;
  if (!data.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: "refresh_token", refresh_token: data.refresh_token,
    }),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await db.from("google_calendar_tokens")
    .update({ access_token: json.access_token, expires_at: newExpiry })
    .eq("user_id", userId);
  return json.access_token;
}

async function findShootingCalendarId(token: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return "primary";
  const data = await res.json();
  const cal = (data.items || []).find((c: any) => /shooting/i.test(c.summary));
  return cal?.id || "primary";
}

async function createGcalEvent(token: string, calendarId: string, event: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.id || null;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const end = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("Unauthorized", { status: 401 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const token = await getValidAccessToken(user.id);
    if (!token) {
      return new Response(JSON.stringify({ connected: false, synced: 0 }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const shootingCalId = await findShootingCalendarId(token);

    // Fetch unsynced tasks and shootings
    const [{ data: tasks }, { data: shootings }] = await Promise.all([
      db.from("tasks").select("id, title, due_date, client_name, description").is("gcal_event_id", null),
      db.from("shootings").select("id, title, date, time, location, client_name, description").is("gcal_event_id", null),
    ]);

    let synced = 0;

    // Sync tasks in parallel (batches of 10 to respect rate limits)
    const taskBatches = chunkArray(tasks || [], 10);
    for (const batch of taskBatches) {
      await Promise.all(batch.map(async (task: any) => {
        if (!task.title) return;
        const descParts: string[] = [];
        if (task.client_name) descParts.push(`Client: ${task.client_name}`);
        if (task.description) descParts.push(task.description);
        const event: Record<string, unknown> = {
          summary: `📋 ${task.title}`,
          description: descParts.join("\n"),
        };
        if (task.due_date) {
          event.start = { date: task.due_date };
          event.end   = { date: nextDay(task.due_date) };
        }
        const gcalId = await createGcalEvent(token, "primary", event);
        if (gcalId) {
          await db.from("tasks").update({ gcal_event_id: gcalId }).eq("id", task.id);
          synced++;
        }
      }));
    }

    // Sync shootings in parallel
    const shootingBatches = chunkArray(shootings || [], 10);
    for (const batch of shootingBatches) {
      await Promise.all(batch.map(async (s: any) => {
        if (!s.title) return;
        const descParts: string[] = [];
        if (s.client_name) descParts.push(`Client: ${s.client_name}`);
        if (s.location) descParts.push(`Location: ${s.location}`);
        if (s.description) descParts.push(s.description);
        const event: Record<string, unknown> = {
          summary: `📸 ${s.title}`,
          description: descParts.join("\n"),
        };
        if (s.date) {
          if (s.time) {
            const startDT = `${s.date}T${s.time}:00`;
            const endDT = new Date(new Date(startDT).getTime() + 2 * 60 * 60 * 1000).toISOString();
            event.start = { dateTime: startDT, timeZone: "Europe/Helsinki" };
            event.end   = { dateTime: endDT,   timeZone: "Europe/Helsinki" };
          } else {
            event.start = { date: s.date };
            event.end   = { date: nextDay(s.date) };
          }
        }
        const gcalId = await createGcalEvent(token, shootingCalId, event);
        if (gcalId) {
          await db.from("shootings").update({ gcal_event_id: gcalId }).eq("id", s.id);
          synced++;
        }
      }));
    }

    return new Response(JSON.stringify({ connected: true, synced }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
