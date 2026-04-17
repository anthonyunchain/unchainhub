import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const respond = (body: object, status = 200) =>
    Response.json(body, { status, headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult as { user: any };

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single();

    if (profile?.role !== 'admin') {
      return respond({ error: 'Forbidden' }, 403);
    }

    const { clientId } = await req.json();
    if (!clientId) return respond({ error: 'Missing clientId' }, 400);

    const { error } = await supabaseAdmin.from('clients').delete().eq('id', clientId);
    if (error) return respond({ error: error.message }, 500);

    return respond({ success: true });

  } catch (err) {
    return respond({ error: err?.message || String(err) }, 500);
  }
});
