import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }

    const { task_id, content, image_url } = await req.json();
    if (!task_id || (!content && !image_url)) {
      return Response.json({ error: 'task_id and (content or image_url) are required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Determine if user is admin or freelancer
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    let authorName = profile?.full_name || user.email || '';
    let authorRole = 'admin';

    if (!isAdmin) {
      // Verify user is a freelancer assigned to this task
      const { data: freelancers } = await supabaseAdmin
        .from('freelancers')
        .select('id, name')
        .eq('email', user.email);

      const freelancer = freelancers?.[0];
      if (!freelancer) {
        return Response.json({ error: 'Not authorized' }, { status: 403, headers: corsHeaders(req) });
      }

      // Verify task is assigned to this freelancer
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('id, assigned_freelancer_id, assigned_to')
        .eq('id', task_id)
        .single();

      if (!task) {
        return Response.json({ error: 'Task not found' }, { status: 404, headers: corsHeaders(req) });
      }

      const name = freelancer.name?.toLowerCase().trim();
      const isAssigned = task.assigned_freelancer_id === freelancer.id
        || (name && task.assigned_to?.toLowerCase().trim() === name);

      if (!isAssigned) {
        return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders(req) });
      }

      authorName = freelancer.name || user.email || '';
      authorRole = 'freelancer';
    }

    // Insert comment
    const { data: comment, error: insertErr } = await supabaseAdmin
      .from('task_comments')
      .insert({
        task_id,
        author_id: user.id,
        author_name: authorName,
        author_role: authorRole,
        content: content || '',
        image_url: image_url || null,
      })
      .select()
      .single();

    if (insertErr) {
      return Response.json({ error: insertErr.message }, { status: 500, headers: corsHeaders(req) });
    }

    return Response.json({ success: true, comment }, { headers: corsHeaders(req) });

  } catch (error) {
    console.error('[addTaskComment] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
