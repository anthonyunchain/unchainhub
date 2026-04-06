import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ALLOWED_EDITING_STATUSES = ["Non assigné", "À faire", "En cours de montage", "En attente de retour", "Terminé"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') return Response.json({ error: 'Use admin interface' }, { status: 403 });

    const { project_id, editing_status, notes } = await req.json();

    if (!project_id) return Response.json({ error: 'Missing project_id' }, { status: 400 });

    // Verify the project is assigned to this freelancer
    const freelancers = await base44.asServiceRole.entities.Freelancer.list();
    const profile = freelancers.find(
      f => f.email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
    );
    if (!profile) return Response.json({ error: 'Not a freelancer' }, { status: 403 });

    const project = await base44.asServiceRole.entities.EditorialContent.get(project_id);

    const isAssigned =
      project.assigned_editor_id === profile.id ||
      project.assigned_editor_name === profile.name;

    if (!isAssigned) return Response.json({ error: 'Not assigned to this project' }, { status: 403 });

    const updates = {};
    if (editing_status && ALLOWED_EDITING_STATUSES.includes(editing_status)) {
      updates.editing_status = editing_status;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }

    const updated = await base44.asServiceRole.entities.EditorialContent.update(project_id, updates);
    return Response.json({ success: true, project: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});