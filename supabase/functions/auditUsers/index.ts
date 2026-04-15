import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const adminResult = await verifyAdmin(req, supabaseAdmin);
    if (adminResult instanceof Response) return adminResult;

    const body = req.method === 'POST' ? await req.json() : {};
    const { action, user_ids } = body; // action: 'audit' | 'delete'

    // Fetch all auth users
    const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return Response.json({ error: authErr.message }, { status: 400, headers: corsHeaders(req) });

    // Fetch all profiles
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name, role');
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    // Fetch freelancers emails
    const { data: freelancers } = await supabaseAdmin.from('freelancers').select('email');
    const freelancerEmails = new Set((freelancers || []).map(f => f.email?.toLowerCase()));

    // Fetch clients with portal_user_id
    const { data: clients } = await supabaseAdmin.from('clients').select('portal_user_id');
    const linkedClientUserIds = new Set((clients || []).map(c => c.portal_user_id).filter(Boolean));

    const orphans: any[] = [];

    for (const user of authUsers) {
      const profile = profileMap[user.id];
      const email = user.email?.toLowerCase() || '';

      // No profile at all
      if (!profile) {
        orphans.push({ id: user.id, email: user.email, full_name: null, role: null, reason: 'No profile' });
        continue;
      }

      // Email is in freelancers table but role is not freelancer — corrupted account
      if (freelancerEmails.has(email) && profile.role !== 'freelancer') {
        orphans.push({ id: user.id, email: user.email, full_name: profile.full_name, role: profile.role, reason: `Freelancer email but role is "${profile.role}" — account was corrupted` });
        continue;
      }

      // Role = freelancer but not in freelancers table
      if (profile.role === 'freelancer' && !freelancerEmails.has(email)) {
        orphans.push({ id: user.id, email: user.email, full_name: profile.full_name, role: profile.role, reason: 'Freelancer role but not in freelancers table' });
        continue;
      }

      // Role = client but not linked to any client record
      if (profile.role === 'client' && !linkedClientUserIds.has(user.id)) {
        orphans.push({ id: user.id, email: user.email, full_name: profile.full_name, role: profile.role, reason: 'Client role but not linked to any client' });
        continue;
      }
    }

    if (action === 'delete' && Array.isArray(user_ids) && user_ids.length > 0) {
      // Delete profiles first (FK constraint)
      await supabaseAdmin.from('profiles').delete().in('id', user_ids);
      // Delete auth users
      for (const uid of user_ids) {
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      return Response.json({ success: true, deleted: user_ids.length }, { headers: corsHeaders(req) });
    }

    return Response.json({ orphans }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
