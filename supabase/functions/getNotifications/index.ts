import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

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
        return Response.json({ notifications: [] }, { headers: corsHeaders });
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
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    // Normalize date field
    const mapped = (notifications || []).map((n: Record<string, unknown>) => ({
      ...n,
      created_date: n.created_at,
    }));

    return Response.json({ notifications: mapped }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
