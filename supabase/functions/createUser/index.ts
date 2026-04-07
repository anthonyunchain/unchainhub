import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Verify the caller is an admin — only admins can create users
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { email, password, full_name, role } = body;

    if (!email || !password) {
      return Response.json({ error: 'email and password are required' }, { status: 400, headers: corsHeaders });
    }

    // Prevent creating admin accounts unless caller is explicitly authorized
    const allowedRoles = ['user', 'freelancer', 'admin'];
    if (role && !allowedRoles.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400, headers: corsHeaders });
    }

    // Create the auth user
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '' },
    });

    if (createErr) {
      return Response.json({ error: createErr.message }, { status: 400, headers: corsHeaders });
    }

    const userId = authData.user.id;

    // Upsert the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, full_name: full_name || '', role: role || 'user' });

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 400, headers: corsHeaders });
    }

    // If freelancer, also create an entry in the freelancers table
    if (role === 'freelancer') {
      await supabaseAdmin.from('freelancers').insert({
        email,
        name: full_name || '',
        status: 'Actif',
      });
    }

    return Response.json({ success: true, user: { id: userId, email, full_name, role } }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
