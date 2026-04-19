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

    const { timeMin, timeMax } = await req.json();

    const token = await getValidAccessToken(user.id);
    if (!token) {
      return new Response(JSON.stringify({ connected: false, events: [] }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const gcalUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    gcalUrl.searchParams.set("timeMin", timeMin);
    gcalUrl.searchParams.set("timeMax", timeMax);
    gcalUrl.searchParams.set("singleEvents", "true");
    gcalUrl.searchParams.set("orderBy", "startTime");
    gcalUrl.searchParams.set("maxResults", "250");

    const res = await fetch(gcalUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ connected: true, events: [], error: "gcal_fetch_failed" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ connected: true, events: data.items || [] }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
