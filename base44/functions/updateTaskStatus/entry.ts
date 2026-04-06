import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ALLOWED_STATUSES = ["Non commencé", "En cours", "Terminé", "Bloqué"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') return Response.json({ error: 'Use admin interface' }, { status: 403 });

    const { task_id, status } = await req.json();

    if (!task_id || !ALLOWED_STATUSES.includes(status)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Fetch freelancer profile and task in parallel
    const [freelancers, tasks] = await Promise.all([
      base44.asServiceRole.entities.Freelancer.filter({ email: user.email }),
      base44.asServiceRole.entities.Task.filter({ id: task_id }),
    ]);

    const profile = freelancers[0];
    if (!profile) return Response.json({ error: 'Not a freelancer' }, { status: 403 });

    const task = tasks[0];
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

    const isAssigned =
      task.assigned_freelancer_id === profile.id ||
      task.assigned_to?.toLowerCase() === profile.name?.toLowerCase();

    if (!isAssigned) {
      return Response.json({ error: 'Not assigned to this task' }, { status: 403 });
    }

    const updated = await base44.asServiceRole.entities.Task.update(task_id, { status });

    return Response.json({ success: true, task: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});