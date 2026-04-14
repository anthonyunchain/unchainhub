import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth, verifyAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const adminResult = await verifyAdmin(req, supabaseAdmin);
    if (adminResult instanceof Response) return adminResult;
    const { user } = adminResult as { user: any; profile: any };

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'email required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return Response.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders(req) });
    }

    // Send invite via service role (the only safe way to do this)
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      return Response.json({ error: inviteError.message }, { status: 400, headers: corsHeaders(req) });
    }

    return Response.json({ success: true }, { headers: corsHeaders(req) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
