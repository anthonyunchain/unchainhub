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

    const today = new Date().toISOString().split('T')[0];

    // Get all content scheduled for today, grouped by client
    const { data: items, error } = await supabaseAdmin
      .from('editorial_content')
      .select('client_name, title, post_type')
      .eq('scheduled_date', today)
      .not('status', 'eq', 'cancelled');

    if (error) throw error;

    // Group by client_name
    const byClient: Record<string, { client_name: string; count: number; titles: string[] }> = {};
    for (const item of (items || [])) {
      if (!item.client_name) continue;
      if (!byClient[item.client_name]) byClient[item.client_name] = { client_name: item.client_name, count: 0, titles: [] };
      byClient[item.client_name].count++;
      if (byClient[item.client_name].titles.length < 2) byClient[item.client_name].titles.push(item.title || item.post_type);
    }

    let totalSent = 0;

    for (const { client_name, count, titles } of Object.values(byClient)) {
      // Find client record
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, portal_token')
        .eq('company_name', client_name)
        .single();

      if (!client) continue;

      // Fetch their push subscriptions from client_push_subscriptions
      const { data: subs } = await supabaseAdmin
        .from('client_push_subscriptions')
        .select('*')
        .eq('client_id', client.id)
        .neq('posting_reminders', false);

      if (!subs?.length) continue;

      const preview = titles.slice(0, 2).join(', ');
      const body = count === 1
        ? `You should post this content today: ${preview}`
        : `You have ${count} posts scheduled today — time to share!`;

      const portalUrl = `${Deno.env.get('PORTAL_BASE_URL') || ''}/portal/${client.portal_token}`;
      const payload = JSON.stringify({ title: '📅 Time to post!', body, url: portalUrl });

      const results = await Promise.allSettled(
        subs.map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          ).catch(async (err: any) => {
            if (err.statusCode === 410) {
              await supabaseAdmin.from('client_push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
            throw err;
          })
        )
      );

      totalSent += results.filter(r => r.status === 'fulfilled').length;
    }

    return Response.json({ success: true, clients: Object.keys(byClient).length, sent: totalSent }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
