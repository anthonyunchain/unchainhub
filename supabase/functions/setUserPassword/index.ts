import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const adminResult = await verifyAdmin(req, supabaseAdmin);
    if (adminResult instanceof Response) return adminResult;

    const { user_id, password } = await req.json();
    if (!user_id || !password) {
      return Response.json({ error: 'user_id and password are required' }, { status: 400, headers: corsHeaders(req) });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password,
      email_confirm: true,
    });

    if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders(req) });

    return Response.json({ success: true }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
