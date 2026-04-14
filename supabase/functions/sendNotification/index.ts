import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }

    // Only admins can send notifications
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (callerProfile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403, headers: corsHeaders(req) });
    }

    const body = await req.json();
    const { recipient_id, title, message, type = 'message' } = body;

    if (!recipient_id || !title || !message) {
      return Response.json({ error: 'Missing required fields: recipient_id, title, message' }, { status: 400, headers: corsHeaders(req) });
    }

    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        recipient_id,
        title,
        message,
        type,
        is_read: false,
        action_required: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
    }

    return Response.json({ success: true, notification }, { headers: corsHeaders(req) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
