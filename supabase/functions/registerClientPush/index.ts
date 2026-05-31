import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { client_id, endpoint, p256dh, auth, unsubscribe } = await req.json();
    if (!client_id || !endpoint) {
      return Response.json({ error: 'Missing client_id or endpoint' }, { status: 400, headers: corsHeaders(req) });
    }

    if (unsubscribe) {
      await supabaseAdmin.from('client_push_subscriptions').delete().eq('endpoint', endpoint);
      return Response.json({ success: true }, { headers: corsHeaders(req) });
    }

    if (!p256dh || !auth) {
      return Response.json({ error: 'Missing p256dh or auth' }, { status: 400, headers: corsHeaders(req) });
    }

    const { error } = await supabaseAdmin
      .from('client_push_subscriptions')
      .upsert({ client_id, endpoint, p256dh, auth }, { onConflict: 'endpoint' });

    if (error) throw error;

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
