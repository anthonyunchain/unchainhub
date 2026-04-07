import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ACTIONS = ['accept', 'decline', 'deliver', 'clarify'] as const;
type Action = typeof ALLOWED_ACTIONS[number];

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

    const body = await req.json();
    const { action, project_id, reason, message, delivery_url } = body;

    if (!action || !project_id) {
      return Response.json({ error: 'Missing action or project_id' }, { status: 400, headers: corsHeaders });
    }

    // Validate action is one of the allowed values
    if (!ALLOWED_ACTIONS.includes(action as Action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders });
    }

    // Resolve freelancer identity — must exist in freelancers table
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id')
      .eq('email', user.email);

    const freelancerId = freelancers?.[0]?.id;

    // Explicitly reject if not a known freelancer
    if (!freelancerId) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    // Fetch the project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders });
    }

    // Verify the project is assigned to this freelancer
    if (project.freelancer_id !== freelancerId) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    let updates: Record<string, unknown> = {};

    switch (action as Action) {
      case 'accept':
        updates = { status: 'Accepted' };
        break;
      case 'decline':
        updates = { status: 'Unassigned', freelancer_id: null, freelancer_name: null };
        break;
      case 'deliver':
        if (!delivery_url || typeof delivery_url !== 'string') {
          return Response.json({ error: 'delivery_url required for deliver action' }, { status: 400, headers: corsHeaders });
        }
        updates = { status: 'Delivered', delivery_url };
        break;
      case 'clarify':
        if (!message || typeof message !== 'string') {
          return Response.json({ error: 'message required for clarify action' }, { status: 400, headers: corsHeaders });
        }
        updates = { notes: `[Question freelancer]: ${message}` };
        break;
    }

    if (action === 'decline' && reason && typeof reason === 'string') {
      updates.notes = `[Declined]: ${reason.slice(0, 500)}`;
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
