import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { corsHeaders } from '../_shared/cors.ts';

const VAPID_PUBLIC_KEY  = 'BEJ8xUeXYtAfm7W36wbzHvxBvczopyE_lRKQIezMB7-dR6LPvWf5LesbrjmXXcQrCA7GLQmMYk66y6UGUjOdFMI';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_EMAIL       = 'mailto:admin@unchainstudio.com';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let { title, body, url = '/', user_ids, freelancer_email } = await req.json();
    if (!title) return Response.json({ error: 'Missing title' }, { status: 400, headers: corsHeaders(req) });

    // Resolve freelancer_email to a user_id if provided
    if (freelancer_email) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
      const u = authData?.users?.find((u: any) => u.email === freelancer_email);
      if (u) user_ids = [...(user_ids || []), u.id];
    }

    // Fetch subscriptions — either for specific users or all
    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (user_ids?.length) query = query.in('user_id', user_ids);
    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body, url });
    const results = await Promise.allSettled(
      (subs || []).map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err) => {
          // Remove stale subscription (410 Gone)
          if (err.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
          throw err;
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return Response.json({ success: true, sent, total: subs?.length ?? 0 }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
