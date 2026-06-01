import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { token, contact_name, contact_email, contact_phone, default_language } = await req.json();
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400, headers: corsHeaders(req) });

    // Validate token
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('portal_token', token)
      .single();

    if (clientErr || !client) {
      return Response.json({ error: 'Invalid token' }, { status: 403, headers: corsHeaders(req) });
    }

    // Only allow safe fields to be updated by client
    const updates: Record<string, any> = {};
    if (contact_name   !== undefined) updates.contact_name   = contact_name;
    if (contact_email  !== undefined) updates.contact_email  = contact_email;
    if (contact_phone  !== undefined) updates.contact_phone  = contact_phone;
    if (default_language !== undefined) updates.default_language = default_language;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400, headers: corsHeaders(req) });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', client.id);

    if (updateErr) throw updateErr;

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
