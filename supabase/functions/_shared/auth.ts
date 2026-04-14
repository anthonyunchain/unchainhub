import { corsHeaders } from './cors.ts';

/**
 * Verify the caller is authenticated via Supabase JWT.
 * Returns `{ user }` on success, or a Response on failure.
 */
export async function verifyAuth(
  req: Request,
  supabaseAdmin: any,
): Promise<{ user: any } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
  }
  return { user };
}

/**
 * Verify the caller is an authenticated admin.
 * Returns `{ user, profile }` on success, or a Response on failure.
 */
export async function verifyAdmin(
  req: Request,
  supabaseAdmin: any,
): Promise<{ user: any; profile: any } | Response> {
  const result = await verifyAuth(req, supabaseAdmin);
  if (result instanceof Response) return result;
  const { user } = result as { user: any };
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders(req) });
  }
  return { user, profile };
}
