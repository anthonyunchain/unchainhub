import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });

    // Verify client role
    const { data: profile } = await supabaseAdmin.from('profiles').select('role, full_name').eq('id', user.id).single();
    if (profile?.role !== 'client') return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders(req) });

    // Find client record by email
    const { data: clients } = await supabaseAdmin.from('clients').select('*').eq('contact_email', user.email);
    const client = clients?.[0];
    if (!client) return Response.json({ error: 'No client record found for this email' }, { status: 404, headers: corsHeaders(req) });

    const companyName = client.company_name;

    // Fetch all data in parallel
    const [contentRes, statsRes, contractsRes] = await Promise.all([
      supabaseAdmin
        .from('editorial_content')
        .select('id, title, post_type, platform, scheduled_date, status, client_name, content_type')
        .eq('client_name', companyName)
        .order('scheduled_date', { ascending: true })
        .limit(500),
      supabaseAdmin
        .from('client_stats')
        .select('*')
        .eq('client_name', companyName)
        .order('period', { ascending: false })
        .limit(24),
      supabaseAdmin
        .from('contracts')
        .select('*')
        .eq('client_name', companyName)
        .order('created_at', { ascending: false }),
    ]);

    return Response.json({
      client,
      content: contentRes.data || [],
      stats: statsRes.data || [],
      contracts: contractsRes.data || [],
    }, { headers: corsHeaders(req) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
