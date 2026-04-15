import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult as { user: any };

    // Get profile (role check)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin') {
      return Response.json({ error: 'Admins cannot access this endpoint' }, { status: 403, headers: corsHeaders(req) });
    }

    // Get freelancer record by email (email is from verified JWT, not user input)
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('*')
      .eq('email', user.email);

    const freelancerProfile = freelancers?.[0] || null;

    if (!freelancerProfile) {
      return Response.json({ error: 'Not a freelancer' }, { status: 403, headers: corsHeaders(req) });
    }

    const fId = freelancerProfile.id;
    // name is used for case-insensitive matching against assigned_to
    const name = freelancerProfile.name?.trim() || '';

    // Parse body for optional task status update
    const body = await req.json().catch(() => ({}));

    // If a task update is requested, verify the task belongs to this freelancer first
    if (body.update_task_id && body.update_task_status) {
      const { data: taskCheck } = await supabaseAdmin
        .from('tasks')
        .select('id, assigned_to')
        .eq('id', body.update_task_id)
        .single();

      const taskBelongsToFreelancer =
        name && taskCheck?.assigned_to?.toLowerCase().trim() === name.toLowerCase();

      if (taskBelongsToFreelancer) {
        await supabaseAdmin
          .from('tasks')
          .update({ status: body.update_task_status })
          .eq('id', body.update_task_id);
      }
    }

    // ── Fetch all data ───────────────────────────────────────────────────────
    const [
      tasksRes,
      editorialRes,
      meetingsByIDRes,
      meetingsByNameRes,
      paymentsByIDRes,
      paymentsByNameRes,
      projectsByIDRes,
      projectsByNameRes,
      toolsRes,
    ] = await Promise.all([
      // Tasks by freelancer name (case-insensitive)
      name
        ? supabaseAdmin.from('tasks').select('*')
            .ilike('assigned_to', name)
            .order('due_date', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
      // Editorial content
      supabaseAdmin.from('editorial_content').select('*')
        .or(`assigned_editor_id.eq.${fId},assigned_editor_name.ilike.${name}`)
        .order('scheduled_date', { ascending: false })
        .limit(300),
      // Meetings by ID
      supabaseAdmin.from('freelancer_meetings').select('*').eq('freelancer_id', fId).order('date', { ascending: false }),
      // Meetings by name fallback
      name
        ? supabaseAdmin.from('freelancer_meetings').select('*')
            .ilike('freelancer_name', name)
            .neq('freelancer_id', fId)
            .order('date', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      // Payments by ID
      supabaseAdmin.from('freelancer_payments').select('*').eq('freelancer_id', fId).order('date', { ascending: false }),
      // Payments by name fallback
      name
        ? supabaseAdmin.from('freelancer_payments').select('*')
            .ilike('freelancer_name', name)
            .neq('freelancer_id', fId)
            .order('date', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      // Assigned projects by ID
      supabaseAdmin.from('projects').select('*').eq('freelancer_id', fId).order('updated_at', { ascending: false }),
      // Assigned projects by name fallback
      name
        ? supabaseAdmin.from('projects').select('*')
            .ilike('freelancer_name', name)
            .neq('freelancer_id', fId)
            .order('updated_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      // Tools (shared)
      supabaseAdmin.from('freelancer_tools').select('*').order('order', { ascending: false }).limit(50),
    ]);

    const tasks = tasksRes.data || [];
    const editorialProjects = editorialRes.data || [];
    const meetings = [...(meetingsByIDRes.data || []), ...(meetingsByNameRes.data || [])];
    const payments = [...(paymentsByIDRes.data || []), ...(paymentsByNameRes.data || [])];
    const assignedProjects = [...(projectsByIDRes.data || []), ...(projectsByNameRes.data || [])];
    const tools = toolsRes.data || [];

    // Visible editorial calendars (specific clients shared with this freelancer)
    const editorialClientNames = (freelancerProfile.editorial_client_names || []) as string[];
    let visibleCalendars: any[] = [];
    if (editorialClientNames.length > 0) {
      const { data: visCalData } = await supabaseAdmin
        .from('editorial_content')
        .select('*')
        .in('client_name', editorialClientNames)
        .order('scheduled_date', { ascending: true })
        .limit(300);
      visibleCalendars = visCalData || [];
    }

    console.log(`[getFreelancerData] freelancer=${name} tasks=${tasks.length}`);

    return Response.json({
      profile: freelancerProfile,
      tasks,
      projects: editorialProjects,
      assignedProjects,
      meetings,
      payments,
      tools,
      visibleCalendars,
    }, { headers: corsHeaders(req) });

  } catch (error) {
    console.error('[getFreelancerData] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
