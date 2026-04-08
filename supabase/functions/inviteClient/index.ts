import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (callerProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });

    const { email, company_name } = await req.json();
    if (!email || typeof email !== 'string') return Response.json({ error: 'email required' }, { status: 400, headers: corsHeaders });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return Response.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders });

    // Invite the user
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { company_name, role: 'client' },
    });

    if (inviteError) return Response.json({ error: inviteError.message }, { status: 400, headers: corsHeaders });

    // Set profile role to client
    if (inviteData?.user?.id) {
      await supabaseAdmin.from('profiles').upsert({
        id: inviteData.user.id,
        full_name: company_name || email,
        role: 'client',
      }, { onConflict: 'id' });
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
