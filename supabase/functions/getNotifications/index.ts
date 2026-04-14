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

    // Check if admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let recipientId: string | null = null;

    if (profile?.role === 'admin') {
      // Admin: body may contain recipient_id to filter, or return all
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch (_) { /* no body */ }
      recipientId = (body.recipient_id as string) || null;
    } else {
      // Freelancer: resolve from JWT email
      const { data: freelancers } = await supabaseAdmin
        .from('freelancers')
        .select('id')
        .eq('email', user.email);
      recipientId = freelancers?.[0]?.id || null;
      if (!recipientId) {
        return Response.json({ notifications: [] }, { headers: corsHeaders(req) });
      }
    }

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (recipientId) {
      query = query.eq('recipient_id', recipientId);
    }

    const { data: notifications, error } = await query;
    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
    }

    // Normalize date field
    const mapped = (notifications || []).map((n: Record<string, unknown>) => ({
      ...n,
      created_date: n.created_at,
    }));

    return Response.json({ notifications: mapped }, { headers: corsHeaders(req) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
