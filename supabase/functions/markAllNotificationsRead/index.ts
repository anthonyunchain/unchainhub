import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth, verifyAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult as { user: any };

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { /* no body */ }

    // Check admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let recipientId: string | null = null;

    if (profile?.role === 'admin') {
      recipientId = (body.recipient_id as string) || null;
    } else {
      const { data: freelancers } = await supabaseAdmin
        .from('freelancers')
        .select('id')
        .eq('email', user.email);
      recipientId = freelancers?.[0]?.id || null;
    }

    let query = supabaseAdmin.from('notifications').update({ is_read: true });
    if (recipientId) {
      query = query.eq('recipient_id', recipientId);
    }

    const { error } = await query;
    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
    }

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
