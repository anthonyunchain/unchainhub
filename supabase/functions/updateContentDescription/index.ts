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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Check caller role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // Resolve freelancer identity if not admin
    let freelancerProfile: { id: string; name: string } | null = null;
    if (!isAdmin) {
      const { data: freelancers } = await supabaseAdmin
        .from('freelancers')
        .select('id, name')
        .eq('email', user.email)
        .limit(1);

      freelancerProfile = freelancers?.[0] || null;
      if (!freelancerProfile) {
        return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
    }

    const { content_id, description } = await req.json();
    if (!content_id) {
      return Response.json({ error: 'content_id required' }, { status: 400, headers: corsHeaders });
    }

    // Sanitize description length
    if (typeof description !== 'string' || description.length > 5000) {
      return Response.json({ error: 'Invalid description' }, { status: 400, headers: corsHeaders });
    }

    if (!isAdmin) {
      // Freelancer: fetch the content item
      const { data: content } = await supabaseAdmin
        .from('editorial_content')
        .select('client_name, assigned_editor_id, assigned_editor_name')
        .eq('id', content_id)
        .single();

      if (!content) {
        return Response.json({ error: 'Content not found' }, { status: 404, headers: corsHeaders });
      }

      // Verify the client has editorial_visible = true
      const { data: visibleClient } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('company_name', content.client_name)
        .eq('editorial_visible', true)
        .maybeSingle();

      if (!visibleClient) {
        return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }

      // Verify this freelancer is the assigned editor (by ID or by name fallback)
      const assignedById = content.assigned_editor_id === freelancerProfile!.id;
      const assignedByName = freelancerProfile!.name?.toLowerCase().trim() &&
        content.assigned_editor_name?.toLowerCase().trim() === freelancerProfile!.name.toLowerCase().trim();

      if (!assignedById && !assignedByName) {
        return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
    }

    const { error } = await supabaseAdmin
      .from('editorial_content')
      .update({ description })
      .eq('id', content_id);

    if (error) throw error;

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
