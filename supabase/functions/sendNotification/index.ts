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

    const adminResult = await verifyAdmin(req, supabaseAdmin);
    if (adminResult instanceof Response) return adminResult;
    const { user } = adminResult as { user: any; profile: any };

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
