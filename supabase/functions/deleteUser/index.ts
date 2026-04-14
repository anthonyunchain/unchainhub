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

    const { user_id } = await req.json();
    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Prevent self-deletion
    if (user_id === user.id) {
      return Response.json({ error: 'Cannot delete your own account' }, { status: 400, headers: corsHeaders(req) });
    }

    // Delete from auth (cascades to profiles via DB trigger if set, else delete manually)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      return Response.json({ error: deleteErr.message }, { status: 400, headers: corsHeaders(req) });
    }

    // Also remove from profiles table (in case no cascade)
    await supabaseAdmin.from('profiles').delete().eq('id', user_id);

    return Response.json({ success: true }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
