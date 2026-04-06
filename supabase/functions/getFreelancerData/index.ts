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

    // Verify caller via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin') {
      return Response.json({ error: 'Admins cannot access this endpoint' }, { status: 403, headers: corsHeaders });
    }

    // Get freelancer record by email
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('*')
      .eq('email', user.email);

    const freelancerProfile = freelancers?.[0] || null;

    if (!freelancerProfile) {
      return Response.json({ error: 'Not a freelancer', email: user.email }, { status: 403, headers: corsHeaders });
    }

    const name = freelancerProfile.name?.toLowerCase().trim();

    // Fetch all data in parallel
    const [tasksByID, allEditorial, meetingsByID, paymentsByID, tools] = await Promise.all([
      supabaseAdmin.from('tasks').select('*').eq('assigned_freelancer_id', freelancerProfile.id),
      supabaseAdmin.from('editorial_content').select('*').order('scheduled_date', { ascending: false }).limit(200),
      supabaseAdmin.from('freelancer_meetings').select('*').eq('freelancer_id', freelancerProfile.id),
      supabaseAdmin.from('freelancer_payments').select('*').eq('freelancer_id', freelancerProfile.id),
      supabaseAdmin.from('freelancer_tools').select('*').order('order', { ascending: false }).limit(50),
    ]);

    const allEditorialData = allEditorial.data || [];

    const myProjects = allEditorialData.filter(c => {
      const byId = c.assigned_editor_id === freelancerProfile.id;
      const byName = name && c.assigned_editor_name?.toLowerCase().trim() === name;
      return byId || byName;
    });

    // Tasks by name fallback
    const { data: allTasks } = await supabaseAdmin.from('tasks').select('*').order('due_date', { ascending: false }).limit(200);
    const tasksByIDData = tasksByID.data || [];
    const tasksByName = (allTasks || []).filter(t =>
      !tasksByIDData.find(x => x.id === t.id) &&
      t.assigned_to?.toLowerCase().trim() === name
    );

    // Payments by name fallback
    const { data: allPayments } = await supabaseAdmin.from('freelancer_payments').select('*').order('date', { ascending: false }).limit(100);
    const paymentsByIDData = paymentsByID.data || [];
    const paymentsByName = (allPayments || []).filter(p =>
      !paymentsByIDData.find(x => x.id === p.id) &&
      p.freelancer_name?.toLowerCase().trim() === name
    );

    // Meetings by name fallback
    const { data: allMeetings } = await supabaseAdmin.from('freelancer_meetings').select('*').order('date', { ascending: false }).limit(100);
    const meetingsByIDData = meetingsByID.data || [];
    const meetingsByName = (allMeetings || []).filter(m =>
      !meetingsByIDData.find(x => x.id === m.id) &&
      m.freelancer_name?.toLowerCase().trim() === name
    );

    // Assigned projects — match by ID or by name fallback
    const { data: projectsByID } = await supabaseAdmin.from('projects').select('*').eq('freelancer_id', freelancerProfile.id);
    const { data: allProjectsData } = await supabaseAdmin.from('projects').select('*').limit(200);
    const projectsByName = (allProjectsData || []).filter(p =>
      !(projectsByID || []).find(x => x.id === p.id) &&
      name && p.freelancer_name?.toLowerCase().trim() === name
    );
    const assignedProjects = [...(projectsByID || []), ...projectsByName];

    // Fetch editorial calendars visible to freelancers
    const { data: visibleClients } = await supabaseAdmin
      .from('clients')
      .select('id, company_name')
      .eq('editorial_visible', true);
    const visibleClientNames = (visibleClients || []).map(c => c.company_name);
    let visibleCalendars = [];
    if (visibleClientNames.length > 0) {
      const { data: visCalData } = await supabaseAdmin
        .from('editorial_content')
        .select('*')
        .in('client_name', visibleClientNames)
        .order('scheduled_date', { ascending: true })
        .limit(300);
      visibleCalendars = visCalData || [];
    }

    return Response.json({
      profile: freelancerProfile,
      tasks: [...tasksByIDData, ...tasksByName],
      projects: myProjects,
      assignedProjects: assignedProjects || [],
      meetings: [...meetingsByIDData, ...meetingsByName],
      payments: [...paymentsByIDData, ...paymentsByName],
      tools: tools.data || [],
      visibleCalendars,
    }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
