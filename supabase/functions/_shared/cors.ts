/**
 * CORS helper for Supabase edge functions.
 * Set the ALLOWED_ORIGIN env variable in the Supabase dashboard to restrict
 * which origin can call these functions (e.g. "https://app.unchainstudio.com").
 * Falls back to "*" if not set (development / staging).
 */
export function corsHeaders(req: Request): Record<string, string> {
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';
  const requestOrigin = req.headers.get('origin') || '';

  // If a specific origin is configured, echo it only when the request origin matches.
  // Otherwise fall back to the configured value (or "*").
  const effectiveOrigin =
    allowedOrigin !== '*' && requestOrigin === allowedOrigin
      ? requestOrigin
      : allowedOrigin;

  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
