import webpush from 'npm:web-push@3';

const VAPID_PUBLIC_KEY  = 'BEJ8xUeXYtAfm7W36wbzHvxBvczopyE_lRKQIezMB7-dR6LPvWf5LesbrjmXXcQrCA7GLQmMYk66y6UGUjOdFMI';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_EMAIL       = 'mailto:admin@unchainstudio.com';

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Send push to specific user IDs (or all subscribers if user_ids is empty)
export async function sendPush(
  supabaseAdmin: any,
  { title, body, url = '/', user_ids }: { title: string; body?: string; url?: string; user_ids?: string[] }
) {
  if (!VAPID_PRIVATE_KEY) return;
  try {
    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (user_ids?.length) query = query.in('user_id', user_ids);
    const { data: subs } = await query;
    if (!subs?.length) return;

    const payload = JSON.stringify({ title, body: body || '', url });
    await Promise.allSettled(
      subs.map((sub: any) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err: any) => {
          if (err.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        })
      )
    );
  } catch (e) {
    console.error('[pushNotify] non-fatal:', e?.message);
  }
}

// Shorthand: push to all admins
export async function pushAdmins(supabaseAdmin: any, opts: { title: string; body?: string; url?: string }) {
  const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await sendPush(supabaseAdmin, { ...opts, user_ids: admins.map((a: any) => a.id) });
}

// Shorthand: push to a freelancer by email
export async function pushFreelancerByEmail(supabaseAdmin: any, email: string, opts: { title: string; body?: string; url?: string }) {
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const user = data?.users?.find((u: any) => u.email === email);
    if (user) await sendPush(supabaseAdmin, { ...opts, user_ids: [user.id] });
  } catch (e) {
    console.error('[pushFreelancerByEmail] non-fatal:', e?.message);
  }
}

// Push to a client by their company_name (looks up contact_email → auth user)
export async function pushClientByName(
  supabaseAdmin: any,
  company_name: string,
  opts: { title: string; body?: string; url?: string }
) {
  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('contact_email, portal_user_id')
      .eq('company_name', company_name)
      .single();
    if (!client) return;

    if (client.portal_user_id) {
      await sendPush(supabaseAdmin, { ...opts, user_ids: [client.portal_user_id] });
    } else if (client.contact_email) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      const user = data?.users?.find((u: any) => u.email === client.contact_email);
      if (user) await sendPush(supabaseAdmin, { ...opts, user_ids: [user.id] });
    }
  } catch (e) {
    console.error('[pushClientByName] non-fatal:', e?.message);
  }
}

// Push to freelancers by their IDs in the freelancers table
export async function pushFreelancersByIds(
  supabaseAdmin: any,
  freelancer_ids: string[],
  opts: { title: string; body?: string; url?: string }
) {
  if (!freelancer_ids?.length) return;
  try {
    const { data: rows } = await supabaseAdmin.from('freelancers').select('email').in('id', freelancer_ids);
    const emails = rows?.map((f: any) => f.email).filter(Boolean) || [];
    if (!emails.length) return;
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const user_ids = data?.users?.filter((u: any) => emails.includes(u.email)).map((u: any) => u.id) || [];
    if (user_ids.length) await sendPush(supabaseAdmin, { ...opts, user_ids });
  } catch (e) {
    console.error('[pushFreelancersByIds] non-fatal:', e?.message);
  }
}
