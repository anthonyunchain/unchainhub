import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { client_id, endpoint, p256dh, auth, unsubscribe, get,
            posting_reminders, portal_notifications } = body;

    if (!endpoint) {
      return Response.json({ error: 'Missing endpoint' }, { status: 400, headers: corsHeaders(req) });
    }

    // Read current prefs for this device
    if (get) {
      const { data } = await supabaseAdmin
        .from('client_push_subscriptions')
        .select('posting_reminders, portal_notifications')
        .eq('endpoint', endpoint)
        .maybeSingle();
      return Response.json({
        subscribed: !!data,
        posting_reminders: data?.posting_reminders ?? false,
        portal_notifications: data?.portal_notifications ?? false,
      }, { headers: corsHeaders(req) });
    }

    if (unsubscribe) {
      await supabaseAdmin.from('client_push_subscriptions').delete().eq('endpoint', endpoint);
      return Response.json({ success: true }, { headers: corsHeaders(req) });
    }

    if (!client_id || !p256dh || !auth) {
      return Response.json({ error: 'Missing client_id, p256dh or auth' }, { status: 400, headers: corsHeaders(req) });
    }

    const { error } = await supabaseAdmin
      .from('client_push_subscriptions')
      .upsert({
        client_id, endpoint, p256dh, auth,
        posting_reminders: posting_reminders ?? true,
        portal_notifications: portal_notifications ?? true,
      }, { onConflict: 'endpoint' });

    if (error) throw error;

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
