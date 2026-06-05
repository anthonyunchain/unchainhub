import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { pushAdmins } from '../_shared/pushNotify.ts';

// Valid editing-status values a freelancer may advance a video item to.
// Mirrors the taxonomy in src/lib/editorialStatus.js (single source of truth).
const ALLOWED_EDITING_STATUSES = [
  'Non assigné',
  'En attente d\'acceptation',
  'À faire',
  'En cours de montage',
  'En attente de retour',
  'Subtitles',
  'Terminé',
];

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

    // Use a user-scoped client to verify the caller's JWT.
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized', detail: authError?.message }, { status: 401, headers: corsHeaders(req) });
    }

    const { project_id, editing_status, notes, final_file_url, final_file_name } = await req.json();
    if (!project_id) {
      return Response.json({ error: 'Missing project_id' }, { status: 400, headers: corsHeaders(req) });
    }

    // Resolve the caller's freelancer record.
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id, name')
      .eq('email', user.email);

    const freelancer = freelancers?.[0];
    if (!freelancer) {
      return Response.json({ error: 'Not a freelancer' }, { status: 403, headers: corsHeaders(req) });
    }

    // Fetch the editorial (video) item — service role bypasses RLS.
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('editorial_content')
      .select('*')
      .eq('id', project_id)
      .single();

    if (itemErr || !item) {
      return Response.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders(req) });
    }

    // Security: verify this item is assigned to this freelancer (by id or name).
    const name = freelancer.name?.toLowerCase().trim();
    const isAssignedById = item.assigned_editor_id === freelancer.id;
    const isAssignedByName = name && item.assigned_editor_name?.toLowerCase().trim() === name;

    if (!isAssignedById && !isAssignedByName) {
      return Response.json({ error: 'Not assigned to this project' }, { status: 403, headers: corsHeaders(req) });
    }

    const updates: Record<string, unknown> = {};
    if (editing_status && ALLOWED_EDITING_STATUSES.includes(editing_status)) {
      updates.editing_status = editing_status;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    // Final deliverable (edited video). Empty string clears it.
    if (final_file_url !== undefined) {
      updates.final_file_url = final_file_url || null;
    }
    if (final_file_name !== undefined) {
      updates.final_file_name = final_file_name || null;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400, headers: corsHeaders(req) });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('editorial_content')
      .update(updates)
      .eq('id', project_id)
      .select()
      .single();

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500, headers: corsHeaders(req) });
    }

    if (updates.final_file_url) {
      pushAdmins(supabaseAdmin, {
        title: `📦 Final file delivered: ${item.title || 'Video'}`,
        body: `${freelancer.name} delivered ${updates.final_file_name || 'a file'}`,
        url: '/Production',
      }).catch(() => {});
    } else if (updates.editing_status) {
      pushAdmins(supabaseAdmin, {
        title: `🎬 Video updated: ${item.title || 'Video'}`,
        body: `${freelancer.name} → "${updates.editing_status}"`,
        url: '/Production',
      }).catch(() => {});
    }

    return Response.json({ success: true, project: updated }, { headers: corsHeaders(req) });

  } catch (error) {
    console.error('[updateProjectStatus] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
