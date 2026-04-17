import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const respond = (body) => Response.json(body, { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult as { user: any };
    const body = await req.json();
    const { action, project_id, reason, message, delivery_url, files } = body;

    if (!action || !project_id) return respond({ error: 'Missing action or project_id' });

    const allowed = ['accept', 'decline', 'deliver', 'clarify'];
    if (!allowed.includes(action)) return respond({ error: 'Invalid action: ' + action });

    // Normalize files payload: array of { path, name, size, uploaded_at }
    const safeFiles = Array.isArray(files)
      ? files
          .filter(f => f && typeof f.path === 'string' && typeof f.name === 'string')
          .map(f => ({
            path: String(f.path),
            name: String(f.name).slice(0, 255),
            size: typeof f.size === 'number' ? f.size : null,
            uploaded_at: f.uploaded_at || new Date().toISOString(),
          }))
      : [];

    // Resolve freelancer
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers').select('id, name').eq('email', user.email);

    const freelancer = freelancers?.[0];
    if (!freelancer) return respond({ error: 'No freelancer found for: ' + user.email });

    // Fetch project (service role — bypasses RLS)
    const { data: project } = await supabaseAdmin
      .from('projects').select('*').eq('id', project_id).single();

    if (!project) return respond({ error: 'Project not found: ' + project_id });

    // Security: verify this project belongs to this freelancer (by id or name)
    const nameMatch = freelancer.name &&
      project.freelancer_name?.toLowerCase().trim() === freelancer.name.toLowerCase().trim();
    const idMatch = project.freelancer_id === freelancer.id;

    if (!idMatch && !nameMatch) {
      return respond({ error: 'This project is not assigned to you.' });
    }

    // Build updates
    let updates: Record<string, unknown> = {};
    if (action === 'accept') {
      updates = { status: 'Accepted' };
    } else if (action === 'decline') {
      updates = { status: 'Unassigned', freelancer_id: null, freelancer_name: null };
    } else if (action === 'deliver') {
      if (!delivery_url && safeFiles.length === 0) {
        return respond({ error: 'Provide a delivery URL or at least one file.' });
      }
      // Append to existing delivery_files so re-delivery keeps history.
      const existing = Array.isArray(project.delivery_files) ? project.delivery_files : [];
      updates = {
        status: 'Delivered',
        delivery_url: delivery_url || project.delivery_url || null,
        delivery_files: [...existing, ...safeFiles],
      };
    } else if (action === 'clarify') {
      if (!message) return respond({ error: 'message required' });
      updates = { notes: `[Question from freelancer]: ${message}` };
    }

    if (action === 'decline' && reason) {
      updates.notes = `[Declined]: ${String(reason).slice(0, 500)}`;
    }

    // Update project (service role — bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', project_id);

    if (updateError) return respond({ error: 'DB error: ' + updateError.message });

    // Notify admins
    const notifMap = {
      deliver: { title: `📦 Delivery: ${project.title}`, message: `${freelancer.name} delivered "${project.title}".`, type: 'delivery', action_required: true },
      accept:  { title: `✅ Accepted: ${project.title}`,  message: `${freelancer.name} accepted "${project.title}".`,  type: 'update', action_required: false },
      decline: { title: `❌ Declined: ${project.title}`,  message: `${freelancer.name} declined "${project.title}".${reason ? ' Reason: ' + reason : ''}`, type: 'update', action_required: false },
      clarify: { title: `💬 Question: ${project.title}`,  message: `${freelancer.name}: ${message}`, type: 'message', action_required: false },
    };

    const notif = notifMap[action];
    if (notif) {
      const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
      if (admins?.length) {
        await supabaseAdmin.from('notifications').insert(
          admins.map(a => ({
            recipient_id: a.id, title: notif.title, message: notif.message,
            type: notif.type, is_read: false, action_required: notif.action_required,
            created_at: new Date().toISOString(),
          }))
        );
      }
    }

    return respond({ success: true });

  } catch (err) {
    return respond({ error: 'Exception: ' + (err?.message || String(err)) });
  }
});
