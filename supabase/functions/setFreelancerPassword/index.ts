import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAdmin } from '../_shared/auth.ts';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const adminResult = await verifyAdmin(req, supabaseAdmin);
    if (adminResult instanceof Response) return adminResult;

    const { email, freelancer_name, freelancer_id, password: inputPassword, force } = await req.json();
    if (!email || typeof email !== 'string') return Response.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders(req) });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return Response.json({ error: 'Invalid email address' }, { status: 400, headers: corsHeaders(req) });

    const password = inputPassword || generatePassword();

    // Look up existing user by email — fetch all and filter client-side
    // (the ?email= query param on the admin API does NOT filter reliably)
    const { data: { users: allUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return Response.json({ error: listErr.message }, { status: 400, headers: corsHeaders(req) });
    const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
    const existingUserId: string | null = existingUser?.id || null;

    let userId: string;

    if (existingUserId) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', existingUserId)
        .single();

      const existingRole = existingProfile?.role;

      // Hard block: never overwrite an admin account
      if (existingRole === 'admin') {
        return Response.json({
          error: 'This email belongs to an admin account. Cannot overwrite.'
        }, { status: 400, headers: corsHeaders(req) });
      }

      // Soft block: warn if non-freelancer, but allow override with force=true
      if (existingRole && existingRole !== 'freelancer' && !force) {
        return Response.json({
          error: `This email belongs to an existing ${existingRole} account.`,
          canForce: true,
        }, { status: 200, headers: corsHeaders(req) });
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      });
      if (updateErr) return Response.json({ error: updateErr.message }, { status: 400, headers: corsHeaders(req) });
      userId = existingUserId;
    } else {
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { freelancer_name, role: 'freelancer' },
      });
      if (createErr) return Response.json({ error: createErr.message }, { status: 400, headers: corsHeaders(req) });
      userId = createData.user.id;
    }

    // Set profile role to freelancer
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: freelancer_name || email,
      role: 'freelancer',
    }, { onConflict: 'id' });

    // Link to freelancer record
    if (freelancer_id) {
      await supabaseAdmin.from('freelancers').update({ user_id: userId }).eq('id', freelancer_id);
    }

    return Response.json({ success: true, email }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
