import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth, verifyAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller via Supabase SDK (not manual JWT decode)
    const adminResult = await verifyAdmin(req, supabaseAdmin);
    if (adminResult instanceof Response) return adminResult;
    const { user } = adminResult as { user: any; profile: any };

    const { email, company_name, client_id } = await req.json();
    if (!email || typeof email !== 'string') return Response.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders(req) });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return Response.json({ error: 'Invalid email address' }, { status: 400, headers: corsHeaders(req) });

    // Try to invite the user
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { company_name, role: 'client' },
    });

    let userId: string | null = null;

    if (inviteError) {
      // If user already exists in auth, look them up and reuse their account
      if (inviteError.message.toLowerCase().includes('already been registered') ||
          inviteError.message.toLowerCase().includes('already registered')) {

        // Look up existing auth user by email via admin REST API
        const adminUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`;
        const adminResp = await fetch(adminUrl, {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          }
        });
        const adminData = await adminResp.json();
        userId = adminData?.users?.[0]?.id || null;

        if (!userId) {
          return Response.json({ error: inviteError.message }, { status: 400, headers: corsHeaders(req) });
        }

        // Send them a password reset email so they can access the portal
        // (ignore rate limit errors — account linking still succeeded)
        await supabaseAdmin.auth.resetPasswordForEmail(email).catch(() => {});

      } else {
        return Response.json({ error: inviteError.message }, { status: 400, headers: corsHeaders(req) });
      }
    } else {
      userId = inviteData?.user?.id || null;
    }

    // Set profile role to client
    if (userId) {
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        full_name: company_name || email,
        role: 'client',
      }, { onConflict: 'id' });

      // Link to client record if client_id provided
      if (client_id) {
        await supabaseAdmin.from('clients').update({
          portal_user_id: userId,
        }).eq('id', client_id);
      }
    }

    return Response.json({ success: true }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
