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

    const { shooting_id, client_status, client_note } = await req.json();
    if (!shooting_id || !client_status) {
      return Response.json({ error: 'shooting_id and client_status required' }, { status: 400, headers: corsHeaders(req) });
    }

    if (!['Approved', 'Declined', 'Cancelled'].includes(client_status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400, headers: corsHeaders(req) });
    }

    // Verify the shooting belongs to this client
    const { data: shooting, error: shootingErr } = await supabaseAdmin
      .from('shootings')
      .select('id, title, client_name, client_status')
      .eq('id', shooting_id)
      .single();

    if (shootingErr || !shooting) {
      return Response.json({ error: 'Shooting not found' }, { status: 404, headers: corsHeaders(req) });
    }

    // Verify client owns this shooting
    const { data: clientRecord } = await supabaseAdmin
      .from('clients')
      .select('company_name')
      .or(`portal_user_id.eq.${user.id},contact_email.eq.${user.email}`)
      .single();

    if (!clientRecord || clientRecord.company_name !== shooting.client_name) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders(req) });
    }

    // Update shooting
    const updatePayload: Record<string, unknown> = { client_status };
    if (client_note) updatePayload.client_note = client_note;

    await supabaseAdmin
      .from('shootings')
      .update(updatePayload)
      .eq('id', shooting_id);

    // Build notification
    const statusLabel = client_status === 'Approved' ? 'approved' : client_status === 'Declined' ? 'declined' : 'cancelled';
    const notifTitle = `📸 Shooting ${statusLabel}: ${shooting.title}`;
    const notifMessage = client_note
      ? `${shooting.client_name} ${statusLabel} the shooting "${shooting.title}". Note: ${client_note}`
      : `${shooting.client_name} ${statusLabel} the shooting "${shooting.title}".`;
    const now = new Date().toISOString();

    // Notify all admins
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins?.length) {
      await supabaseAdmin.from('notifications').insert(
        admins.map((a: { id: string }) => ({
          recipient_id: a.id,
          title: notifTitle,
          message: notifMessage,
          type: 'shooting_response',
          is_read: false,
          action_required: false,
          created_at: now,
        }))
      );
    }

    // Notify assigned freelancers
    const { data: assignments } = await supabaseAdmin
      .from('shooting_assignments')
      .select('freelancer_id')
      .eq('shooting_id', shooting_id);

    if (assignments?.length) {
      await supabaseAdmin.from('notifications').insert(
        assignments.map((a: { freelancer_id: string }) => ({
          recipient_id: a.freelancer_id,
          title: notifTitle,
          message: notifMessage,
          type: 'shooting_response',
          is_read: false,
          action_required: false,
          created_at: now,
        }))
      );
    }

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (error) {
    console.error('[respondToShooting] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
