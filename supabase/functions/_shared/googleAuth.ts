import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

export const supabaseAdmin = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface TokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single<TokenRow>();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return data.access_token;

  if (!data.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });

  if (!res.ok) return null;

  const json = await res.json();
  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await db
    .from("google_calendar_tokens")
    .update({ access_token: json.access_token, expires_at: newExpiry })
    .eq("user_id", userId);

  return json.access_token;
}
