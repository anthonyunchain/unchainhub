import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidAccessToken } from "../_shared/googleAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const token = await getValidAccessToken(user.id);
    if (!token) {
      return new Response(JSON.stringify({ error: "not_connected" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const event: Record<string, unknown> = {
      summary: body.summary,
      description: body.description ?? "",
    };

    if (body.allDay) {
      const dateStr = body.start.slice(0, 10);
      event.start = { date: dateStr };
      event.end = { date: dateStr };
    } else {
      event.start = { dateTime: body.start, timeZone: "Europe/Helsinki" };
      event.end = { dateTime: body.end, timeZone: "Europe/Helsinki" };
    }

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
