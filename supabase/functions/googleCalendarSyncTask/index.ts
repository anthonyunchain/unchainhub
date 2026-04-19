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

    const body = await req.json();
    // body: { taskId, title, due_date?, client_name?, description?, gcal_event_id? }
    const { taskId, title, due_date, client_name, description, gcal_event_id } = body;

    const token = await getValidAccessToken(user.id);
    if (!token) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const descParts: string[] = [];
    if (client_name) descParts.push(`Client: ${client_name}`);
    if (description) descParts.push(description);

    const event: Record<string, unknown> = {
      summary: `📋 ${title}`,
      description: descParts.join("\n"),
    };

    if (due_date) {
      // All-day event on due_date; end = next day per Google Calendar API spec
      const [y, m, d] = due_date.split("-").map(Number);
      const endDate = new Date(y, m - 1, d + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const endStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
      event.start = { date: due_date };
      event.end   = { date: endStr };
    }

    let gcalRes: Response;
    if (gcal_event_id) {
      gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcal_event_id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }
      );
    } else {
      gcalRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
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

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await db.from("tasks").update({ gcal_event_id: gcalData.id }).eq("id", taskId);

    return new Response(JSON.stringify({ connected: true, gcal_event_id: gcalData.id }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
