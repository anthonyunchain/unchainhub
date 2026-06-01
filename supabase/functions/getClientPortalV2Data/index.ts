import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { token } = await req.json();
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400, headers: corsHeaders(req) });

    // Validate token and get client
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('portal_token', token)
      .single();

    if (clientErr || !client) {
      return Response.json({ error: 'Invalid token' }, { status: 403, headers: corsHeaders(req) });
    }

    const companyName = client.company_name;

    const [contentRes, shootingsRes, contractsRes, docsRes, tutorialsRes, credRes, invoicesRes] = await Promise.all([
      supabaseAdmin
        .from('editorial_content')
        .select('id, title, description, post_type, platform, scheduled_date, status, client_name, content_type, drive_url, cover_image_url, reel_description')
        .eq('client_name', companyName)
        .not('status', 'eq', 'cancelled')
        .order('scheduled_date', { ascending: true })
        .limit(500),
      supabaseAdmin
        .from('shootings')
        .select('id, title, date, time, location, status, description, notes, images')
        .eq('client_name', companyName)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabaseAdmin
        .from('contracts')
        .select('id, title, status, start_date, end_date, amount, currency, contract_url, client_name')
        .eq('client_name', companyName)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('client_documents')
        .select('id, title, files, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('tutorials')
        .select('id, title, description, video_url, youtube_url, category, thumbnail_url, position, sort_order')
        .order('position', { ascending: true }),
      supabaseAdmin.rpc('get_client_credentials', { p_client_id: client.id }),
      supabaseAdmin
        .from('invoices')
        .select('id, invoice_number, description, total_amount, total_with_tax, status, issue_date, due_date, paid_date, file_url, file_urls, client_name')
        .eq('client_name', companyName)
        .order('issue_date', { ascending: false }),
    ]);

    // Sign document file paths server-side (portal has no auth session)
    const documents = await Promise.all((docsRes.data || []).map(async (doc: any) => {
      const files = await Promise.all((Array.isArray(doc.files) ? doc.files : []).map(async (f: any) => {
        let url = null;
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from('client-documents')
            .createSignedUrl(f.path, 3600);
          url = signed?.signedUrl || null;
        } catch (_) { /* ignore */ }
        return { ...f, url };
      }));
      return { ...doc, files };
    }));

    return Response.json({
      client,
      content: contentRes.data || [],
      shootings: shootingsRes.data || [],
      contracts: contractsRes.data || [],
      documents,
      tutorials: tutorialsRes.data || [],
      credentials: credRes.data || [],
      invoices: invoicesRes.data || [],
    }, { headers: corsHeaders(req) });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) });
  }
});
