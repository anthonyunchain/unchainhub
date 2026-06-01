import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { token, type, subject, message, preferred_date, preferred_time } = await req.json();

    if (!token) return Response.json({ error: 'Missing token' }, { status: 400, headers: corsHeaders(req) });
    if (!message?.trim()) return Response.json({ error: 'Message is required' }, { status: 400, headers: corsHeaders(req) });
    if (!['meeting', 'question', 'other'].includes(type)) return Response.json({ error: 'Invalid type' }, { status: 400, headers: corsHeaders(req) });

    // Validate token
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, company_name')
      .eq('portal_token', token)
      .single();

    if (clientErr || !client) {
      return Response.json({ error: 'Invalid token' }, { status: 403, headers: corsHeaders(req) });
    }

    const { error } = await supabaseAdmin
      .from('client_portal_requests')
      .insert({
        client_id: client.id,
        client_name: client.company_name,
        type,
        subject: subject || null,
        message: message.trim(),
        preferred_date: preferred_date || null,
        preferred_time: preferred_time || null,
        status: 'new',
      });

    if (error) throw error;

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
