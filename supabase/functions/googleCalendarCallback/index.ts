import { supabaseAdmin } from "../_shared/googleAuth.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/googleCalendarCallback`;
const APP_URL = "https://unchainhub.vercel.app";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user_id
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return Response.redirect(`${APP_URL}/Planning?gcal_error=1`, 302);
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      return Response.redirect(`${APP_URL}/Planning?gcal_error=1`, 302);
    }

    const json = await res.json();
    const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

    const db = supabaseAdmin();
    await db.from("google_calendar_tokens").upsert({
      user_id: state,
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? null,
      expires_at: expiresAt,
    }, { onConflict: "user_id" });

    return Response.redirect(`${APP_URL}/Planning?connected=1`, 302);
  } catch {
    return Response.redirect(`${APP_URL}/Planning?gcal_error=1`, 302);
  }
});
