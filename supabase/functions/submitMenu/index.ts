import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { pushAdmins } from '../_shared/pushNotify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult as { user: any };

    const { title, period, notes, files } = await req.json();
    if (!title || typeof title !== 'string' || !title.trim()) {
      return Response.json({ error: 'Title is required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Resolve the client this staff user belongs to
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, company_name')
      .eq('staff_user_id', user.id)
      .maybeSingle();

    if (!client) {
      return Response.json({ error: 'No client linked to this staff account' }, { status: 403, headers: corsHeaders(req) });
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('menu_submissions')
      .insert({
        client_id: client.id,
        staff_id: user.id,
        title: title.trim(),
        period: period?.trim() || null,
        notes: notes?.trim() || null,
        files: Array.isArray(files) ? files : [],
      })
      .select('id')
      .single();

    if (insertErr) return Response.json({ error: insertErr.message }, { status: 400, headers: corsHeaders(req) });

    // Fire-and-forget admin notifications (non-fatal)
    try {
      const notifTitle = `🍽️ New menu: ${client.company_name}`;
      const notifMessage = `${title.trim()}${period?.trim() ? ` — ${period.trim()}` : ''}`;
      const url = `/ClientDetail?id=${client.id}`;

      const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
      if (admins?.length) {
        await supabaseAdmin.from('notifications').insert(
          admins.map((a: any) => ({
            recipient_id: a.id,
            title: notifTitle,
            message: notifMessage,
            type: 'menu',
            is_read: false,
            action_required: true,
            created_at: new Date().toISOString(),
          })),
        );
      }
      await pushAdmins(supabaseAdmin, { title: notifTitle, body: notifMessage, url });
    } catch (notifErr) {
      console.error('[submitMenu] notif non-fatal:', (notifErr as Error)?.message);
    }

    return Response.json({ success: true, id: inserted?.id }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders(req) });
  }
});
