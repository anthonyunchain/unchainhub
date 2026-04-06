import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role === 'admin') {
      return Response.json({ error: 'Admins cannot access freelancer data via this endpoint' }, { status: 403 });
    }

    // Get freelancer profile via service role
    const freelancers = await base44.asServiceRole.entities.Freelancer.filter({ email: user.email });
    const profile = freelancers[0] || null;

    if (!profile) {
      return Response.json({ error: 'Not a freelancer', email: user.email }, { status: 403 });
    }

    const name = profile.name?.toLowerCase().trim();
    console.log('[getFreelancerData] Profile found:', profile.id, profile.name, '| name key:', name);

    // Fetch tasks and meetings by ID, editorial content and tools via full list
    const [tasksByID, allEditorial, meetingsByID, paymentsByID, tools] = await Promise.all([
      base44.asServiceRole.entities.Task.filter({ assigned_freelancer_id: profile.id }),
      base44.asServiceRole.entities.EditorialContent.list('-scheduled_date', 200),
      base44.asServiceRole.entities.FreelancerMeeting.filter({ freelancer_id: profile.id }),
      base44.asServiceRole.entities.FreelancerPayment.filter({ freelancer_id: profile.id }),
      base44.asServiceRole.entities.FreelancerTool.list('-order', 50),
    ]);

    console.log('[getFreelancerData] allEditorial count:', allEditorial.length);

    // Filter projects assigned to this freelancer (by ID or by name fallback)
    const myProjects = allEditorial.filter(c => {
      const byId = c.assigned_editor_id === profile.id;
      const byName = name && c.assigned_editor_name?.toLowerCase().trim() === name;
      return byId || byName;
    });

    console.log('[getFreelancerData] myProjects count:', myProjects.length);
    console.log('[getFreelancerData] sample project editor_id:', allEditorial[0]?.assigned_editor_id, '| profile.id:', profile.id);

    // Tasks also by name fallback
    const allTasks = await base44.asServiceRole.entities.Task.list('-due_date', 200);
    const tasksByName = allTasks.filter(t =>
      !tasksByID.find(x => x.id === t.id) &&
      t.assigned_to?.toLowerCase().trim() === name
    );

    // Payments also by name fallback
    const allPayments = await base44.asServiceRole.entities.FreelancerPayment.list('-date', 100);
    const paymentsByName = allPayments.filter(p =>
      !paymentsByID.find(x => x.id === p.id) &&
      p.freelancer_name?.toLowerCase().trim() === name
    );

    // Meetings also by name fallback
    const allMeetings = await base44.asServiceRole.entities.FreelancerMeeting.list('-date', 100);
    const meetingsByName = allMeetings.filter(m =>
      !meetingsByID.find(x => x.id === m.id) &&
      m.freelancer_name?.toLowerCase().trim() === name
    );

    // Fetch assigned projects (Project entity, new acceptance flow)
    const assignedProjects = await base44.asServiceRole.entities.Project.filter({ assigned_freelancer_id: profile.id });

    return Response.json({
      profile,
      tasks: [...tasksByID, ...tasksByName],
      projects: myProjects,
      assignedProjects,
      meetings: [...meetingsByID, ...meetingsByName],
      payments: [...paymentsByID, ...paymentsByName],
      tools,
    });
  } catch (error) {
    console.error('[getFreelancerData] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});