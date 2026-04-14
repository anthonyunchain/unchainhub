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

    const body = await req.json();
    const { notification_id } = body;
    if (!notification_id) {
      return Response.json({ error: 'Missing notification_id' }, { status: 400, headers: corsHeaders(req) });
    }

    // Only allow deleting notifications belonging to this user
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notification_id)
      .eq('recipient_id', user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
    }

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
