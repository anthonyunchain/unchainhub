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

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { action, project_id, reason, message, delivery_url } = await req.json();

    if (!action || !project_id) {
      return Response.json({ error: 'Missing action or project_id' }, { status: 400, headers: corsHeaders });
    }

    // Verify the project belongs to this freelancer
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id')
      .eq('email', user.email);
    const freelancerId = freelancers?.[0]?.id;

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders });
    }

    if (project.freelancer_id !== freelancerId) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    let updates: Record<string, unknown> = {};

    switch (action) {
      case 'accept':
        updates = { status: 'Accepted' };
        break;
      case 'decline':
        updates = { status: 'Unassigned', freelancer_id: null, freelancer_name: null };
        break;
      case 'deliver':
        updates = { status: 'Delivered', ...(delivery_url && { delivery_url }) };
        break;
      case 'clarify':
        updates = { notes: message ? `[Question freelancer]: ${message}` : project.notes };
        break;
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
    }

    if (action === 'decline' && reason) {
      updates.notes = `[Declined]: ${reason}`;
    }

    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', project_id);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
