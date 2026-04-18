import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { pushAdmins } from '../_shared/pushNotify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }

    // Use user-scoped client to verify the caller's JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized', detail: authError?.message }, { status: 401, headers: corsHeaders(req) });
    }

    const { task_id, status } = await req.json();
    if (!task_id || !status) {
      return Response.json({ error: 'task_id and status are required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Verify the task is assigned to this user's freelancer record
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id, name')
      .eq('email', user.email);

    const freelancer = freelancers?.[0];
    if (!freelancer) {
      return Response.json({ error: 'Not a freelancer' }, { status: 403, headers: corsHeaders(req) });
    }

    // Fetch the task to verify ownership
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, title, assigned_freelancer_id, assigned_to')
      .eq('id', task_id)
      .single();

    if (taskErr || !task) {
      return Response.json({ error: 'Task not found' }, { status: 404, headers: corsHeaders(req) });
    }

    const name = freelancer.name?.toLowerCase().trim();
    const isAssignedById = task.assigned_freelancer_id === freelancer.id;
    const isAssignedByName = name && task.assigned_to?.toLowerCase().trim() === name;

    if (!isAssignedById && !isAssignedByName) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders(req) });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('tasks')
      .update({ status })
      .eq('id', task_id);

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500, headers: corsHeaders(req) });
    }

    pushAdmins(supabaseAdmin, {
      title: `✅ Task updated: ${task.title || 'Task'}`,
      body: `${freelancer.name} marked it as "${status}"`,
      url: '/Tasks',
    }).catch(() => {});

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (error) {
    console.error('[updateTaskStatus] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
