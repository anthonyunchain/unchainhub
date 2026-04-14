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

    // Verify caller via Supabase auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { task_id, status } = await req.json();
    if (!task_id || !status) {
      return Response.json({ error: 'task_id and status are required' }, { status: 400, headers: corsHeaders });
    }

    // Verify the task is assigned to this user's freelancer record
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id, name')
      .eq('email', user.email);

    const freelancer = freelancers?.[0];
    if (!freelancer) {
      return Response.json({ error: 'Not a freelancer' }, { status: 403, headers: corsHeaders });
    }

    // Fetch the task to verify ownership
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, assigned_freelancer_id, assigned_to')
      .eq('id', task_id)
      .single();

    if (taskErr || !task) {
      return Response.json({ error: 'Task not found' }, { status: 404, headers: corsHeaders });
    }

    const name = freelancer.name?.toLowerCase().trim();
    const isAssignedById = task.assigned_freelancer_id === freelancer.id;
    const isAssignedByName = name && task.assigned_to?.toLowerCase().trim() === name;

    if (!isAssignedById && !isAssignedByName) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('tasks')
      .update({ status })
      .eq('id', task_id);

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error('[updateTaskStatus] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
