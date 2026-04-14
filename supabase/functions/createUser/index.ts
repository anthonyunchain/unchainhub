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
    const { email, password, full_name, role } = body;

    if (!email || !password) {
      return Response.json({ error: 'email and password are required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Prevent creating admin accounts unless caller is explicitly authorized
    const allowedRoles = ['user', 'freelancer', 'admin'];
    if (role && !allowedRoles.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400, headers: corsHeaders(req) });
    }

    // Create the auth user
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '' },
    });

    if (createErr) {
      return Response.json({ error: createErr.message }, { status: 400, headers: corsHeaders(req) });
    }

    const userId = authData.user.id;

    // Upsert the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, full_name: full_name || '', role: role || 'user' });

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 400, headers: corsHeaders(req) });
    }

    // If freelancer, also create an entry in the freelancers table
    if (role === 'freelancer') {
      await supabaseAdmin.from('freelancers').insert({
        email,
        name: full_name || '',
        status: 'Actif',
      });
    }

    return Response.json({ success: true, user: { id: userId, email, full_name, role } }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
