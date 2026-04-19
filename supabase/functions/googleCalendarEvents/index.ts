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

    const { timeMin, timeMax } = await req.json();

    const token = await getValidAccessToken(user.id);
    if (!token) {
      return new Response(JSON.stringify({ connected: false, events: [] }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get all calendars
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!calListRes.ok) {
      return new Response(JSON.stringify({ connected: true, events: [] }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const calList = await calListRes.json();
    const calendars: any[] = calList.items || [];

    // Fetch events from all visible calendars in parallel
    const allEvents = await Promise.all(
      calendars
        .filter((c: any) => c.selected !== false)
        .map(async (cal: any) => {
          const url = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
          );
          url.searchParams.set("timeMin", timeMin);
          url.searchParams.set("timeMax", timeMax);
          url.searchParams.set("singleEvents", "true");
          url.searchParams.set("orderBy", "startTime");
          url.searchParams.set("maxResults", "100");
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.items || []).map((ev: any) => ({
            ...ev,
            _calendarName: cal.summary,
            _calendarColor: cal.backgroundColor,
          }));
        })
    );

    // Merge, dedupe by id, sort by start
    const seen = new Set<string>();
    const merged = allEvents
      .flat()
      .filter((ev: any) => { if (seen.has(ev.id)) return false; seen.add(ev.id); return true; })
      .sort((a: any, b: any) => {
        const aTime = a.start?.dateTime || a.start?.date || "";
        const bTime = b.start?.dateTime || b.start?.date || "";
        return aTime.localeCompare(bTime);
      });

    return new Response(JSON.stringify({ connected: true, events: merged }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
