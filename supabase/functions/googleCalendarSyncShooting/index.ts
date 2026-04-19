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

// Find a calendar named "Shooting" or "Shootings", else fall back to primary
async function findShootingCalendarId(token: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return "primary";
  const data = await res.json();
  const cal = (data.items || []).find((c: any) =>
    /shooting/i.test(c.summary)
  );
  return cal?.id || "primary";
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

    const body = await req.json();
    // body: { shootingId, title, date, time?, location?, client_name?, description?, gcal_event_id? }
    const { shootingId, title, date, time, location, client_name, description, gcal_event_id } = body;

    const token = await getValidAccessToken(user.id);
    if (!token) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const calendarId = encodeURIComponent(await findShootingCalendarId(token));

    // Build event object
    const descParts = [];
    if (client_name) descParts.push(`Client: ${client_name}`);
    if (location) descParts.push(`Location: ${location}`);
    if (description) descParts.push(description);

    const event: Record<string, unknown> = {
      summary: `📸 ${title}`,
      description: descParts.join("\n"),
    };

    if (date) {
      if (time) {
        // timed event — 2h duration
        const startDT = `${date}T${time}:00`;
        const startMs = new Date(startDT).getTime();
        const endDT = new Date(startMs + 2 * 60 * 60 * 1000).toISOString();
        event.start = { dateTime: startDT, timeZone: "Europe/Helsinki" };
        event.end   = { dateTime: endDT,   timeZone: "Europe/Helsinki" };
      } else {
        event.start = { date };
        event.end   = { date };
      }
    }

    let gcalRes: Response;
    if (gcal_event_id) {
      // PATCH existing event
      gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${gcal_event_id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }
      );
    } else {
      // POST new event
      gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }
      );
    }

    const gcalData = await gcalRes.json();
    if (!gcalRes.ok) {
      return new Response(JSON.stringify({ error: gcalData }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Persist gcal_event_id back to the shooting
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await db.from("shootings").update({ gcal_event_id: gcalData.id }).eq("id", shootingId);

    return new Response(JSON.stringify({ connected: true, gcal_event_id: gcalData.id }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
