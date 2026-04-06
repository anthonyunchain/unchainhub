import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Freelancer actions on projects: accept, decline, deliver, request_clarification
// Admin actions: create_project, reassign, complete, request_revision

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, project_id, ...payload } = body;

    const isAdmin = user.role === 'admin';

    // ── ADMIN: Create project ───────────────────────────────────────────────
    if (action === 'create_project') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const project = await base44.asServiceRole.entities.Project.create({
        ...payload,
        status: payload.assigned_freelancer_id ? 'Pending acceptance' : 'Unassigned',
      });

      if (payload.assigned_freelancer_id) {
        // Notify freelancer
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: payload.assigned_freelancer_id,
          recipient_role: 'freelancer',
          type: 'project_assigned',
          title: 'New project assigned to you',
          message: `You have been assigned to "${project.title}" for ${project.client_name}. Deadline: ${project.deadline || 'TBD'}. Please review and accept or decline.`,
          project_id: project.id,
          project_title: project.title,
          freelancer_name: payload.assigned_freelancer_name || '',
          is_read: false,
          action_required: true,
        });
      }
      return Response.json({ project });
    }

    // ── ADMIN: Assign / Reassign ────────────────────────────────────────────
    if (action === 'assign') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const project = await base44.asServiceRole.entities.Project.update(project_id, {
        assigned_freelancer_id: payload.freelancer_id,
        assigned_freelancer_name: payload.freelancer_name,
        status: 'Pending acceptance',
        decline_reason: '',
      });
      await base44.asServiceRole.entities.Notification.create({
        recipient_id: payload.freelancer_id,
        recipient_role: 'freelancer',
        type: 'project_assigned',
        title: 'New project assigned to you',
        message: `You have been assigned to "${project.title}" for ${project.client_name}. Deadline: ${project.deadline || 'TBD'}. Please review and accept or decline.`,
        project_id: project.id,
        project_title: project.title,
        freelancer_name: payload.freelancer_name || '',
        is_read: false,
        action_required: true,
      });
      return Response.json({ project });
    }

    // ── ADMIN: Complete ─────────────────────────────────────────────────────
    if (action === 'complete') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const proj = await base44.asServiceRole.entities.Project.update(project_id, { status: 'Completed' });
      if (proj.assigned_freelancer_id) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: proj.assigned_freelancer_id,
          recipient_role: 'freelancer',
          type: 'project_completed',
          title: 'Project marked as completed',
          message: `"${proj.title}" has been marked as completed by the admin. Great work!`,
          project_id: proj.id,
          project_title: proj.title,
          is_read: false,
          action_required: false,
        });
      }
      return Response.json({ project: proj });
    }

    // ── ADMIN: Update project ─────────────────────────────────────────────
    if (action === 'update') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const proj = await base44.asServiceRole.entities.Project.update(project_id, payload);
      return Response.json({ project: proj });
    }

    // ── ADMIN: Request revision ─────────────────────────────────────────────
    if (action === 'request_revision') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const proj = await base44.asServiceRole.entities.Project.update(project_id, {
        status: 'Revision requested',
        notes: payload.notes || '',
      });
      if (proj.assigned_freelancer_id) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: proj.assigned_freelancer_id,
          recipient_role: 'freelancer',
          type: 'revision_requested',
          title: 'Revision requested',
          message: `The admin has requested a revision for "${proj.title}". ${payload.notes ? `Notes: ${payload.notes}` : ''}`,
          project_id: proj.id,
          project_title: proj.title,
          is_read: false,
          action_required: true,
        });
      }
      return Response.json({ project: proj });
    }

    // ── FREELANCER: Accept ──────────────────────────────────────────────────
    if (action === 'accept') {
      const proj = await base44.asServiceRole.entities.Project.update(project_id, { status: 'Accepted' });
      // Notify all admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: admin.id,
          recipient_role: 'admin',
          type: 'project_accepted',
          title: `${proj.assigned_freelancer_name || 'Freelancer'} accepted a project`,
          message: `"${proj.assigned_freelancer_name || 'A freelancer'}" has accepted "${proj.title}".`,
          project_id: proj.id,
          project_title: proj.title,
          freelancer_name: proj.assigned_freelancer_name || '',
          is_read: false,
          action_required: false,
        });
      }
      return Response.json({ project: proj });
    }

    // ── FREELANCER: Decline ─────────────────────────────────────────────────
    if (action === 'decline') {
      const proj = await base44.asServiceRole.entities.Project.update(project_id, {
        status: 'Unassigned',
        assigned_freelancer_id: '',
        assigned_freelancer_name: '',
        decline_reason: payload.reason || '',
      });
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: admin.id,
          recipient_role: 'admin',
          type: 'project_declined',
          title: `${payload.freelancer_name || 'Freelancer'} declined a project`,
          message: `"${payload.freelancer_name || 'A freelancer'}" has declined "${proj.title}".${payload.reason ? ` Reason: ${payload.reason}` : ''} Please reassign.`,
          project_id: proj.id,
          project_title: proj.title,
          freelancer_name: payload.freelancer_name || '',
          is_read: false,
          action_required: true,
        });
      }
      return Response.json({ project: proj });
    }

    // ── FREELANCER: Mark delivered ──────────────────────────────────────────
    if (action === 'deliver') {
      const proj = await base44.asServiceRole.entities.Project.update(project_id, { status: 'Delivered' });
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: admin.id,
          recipient_role: 'admin',
          type: 'project_delivered',
          title: `${proj.assigned_freelancer_name || 'Freelancer'} delivered a project`,
          message: `"${proj.assigned_freelancer_name || 'A freelancer'}" has marked "${proj.title}" as delivered.`,
          project_id: proj.id,
          project_title: proj.title,
          freelancer_name: proj.assigned_freelancer_name || '',
          is_read: false,
          action_required: true,
        });
      }
      return Response.json({ project: proj });
    }

    // ── FREELANCER: Request clarification ──────────────────────────────────
    if (action === 'clarify') {
      const proj = await base44.asServiceRole.entities.Project.update(project_id, {
        clarification_request: payload.message || '',
      });
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: admin.id,
          recipient_role: 'admin',
          type: 'clarification_requested',
          title: `${proj.assigned_freelancer_name || 'Freelancer'} requests clarification`,
          message: `"${proj.assigned_freelancer_name || 'A freelancer'}" has a question about "${proj.title}": ${payload.message || ''}`,
          project_id: proj.id,
          project_title: proj.title,
          freelancer_name: proj.assigned_freelancer_name || '',
          is_read: false,
          action_required: true,
        });
      }
      return Response.json({ project: proj });
    }

    // ── Mark notification as read ────────────────────────────────────────────
    if (action === 'mark_read') {
      await base44.asServiceRole.entities.Notification.update(payload.notification_id, { is_read: true });
      return Response.json({ ok: true });
    }

    if (action === 'mark_all_read') {
      const notifs = await base44.asServiceRole.entities.Notification.filter({
        recipient_id: payload.recipient_id,
        is_read: false,
      });
      await Promise.all(notifs.map(n => base44.asServiceRole.entities.Notification.update(n.id, { is_read: true })));
      return Response.json({ ok: true, count: notifs.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[projectAction]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});