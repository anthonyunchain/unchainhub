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
    if (body.update_task_id && (body.update_task_status || typeof body.append_task_note === 'string')) {
      const { data: taskCheck } = await supabaseAdmin
        .from('tasks')
        .select('id, assigned_to, assigned_freelancer_id, title, note_thread')
        .eq('id', body.update_task_id)
        .single();

      const nameMatch =
        name && taskCheck?.assigned_to?.toLowerCase().trim() === name.toLowerCase();
      const idMatch =
        taskCheck?.assigned_freelancer_id && taskCheck.assigned_freelancer_id === fId;
      const taskBelongsToFreelancer = nameMatch || idMatch;

      if (taskBelongsToFreelancer) {
        // Status update
        if (body.update_task_status) {
          await supabaseAdmin
            .from('tasks')
            .update({ status: body.update_task_status })
            .eq('id', body.update_task_id);
        }

        // Append a new message to the note thread
        if (typeof body.append_task_note === 'string' && body.append_task_note.trim()) {
          const text = body.append_task_note.trim();
          const newMessage = {
            id: crypto.randomUUID(),
            author_role: 'freelancer',
            author_name: name || 'Freelancer',
            text,
            created_at: new Date().toISOString(),
          };
          const existingThread = Array.isArray(taskCheck?.note_thread) ? taskCheck.note_thread : [];
          const nextThread = [...existingThread, newMessage];

          await supabaseAdmin
            .from('tasks')
            .update({ note_thread: nextThread })
            .eq('id', body.update_task_id);

          // Notify admins
          const { data: admins, error: adminErr } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'admin');
          if (adminErr) console.error('[getFreelancerData] admin lookup error', adminErr);
          const snippet = text.length > 160 ? text.slice(0, 160) + '…' : text;
          const rows = (admins || []).map((a: { id: string }) => ({
            recipient_id: a.id,
            title: `${name || 'Freelancer'} · ${taskCheck?.title || 'task'}`,
            message: snippet,
            type: 'message',
            is_read: false,
            action_required: false,
            created_at: new Date().toISOString(),
          }));
          if (rows.length > 0) {
            const { error: notifErr } = await supabaseAdmin.from('notifications').insert(rows);
            if (notifErr) console.error('[getFreelancerData] notifications insert error', notifErr);
          }
        }
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
