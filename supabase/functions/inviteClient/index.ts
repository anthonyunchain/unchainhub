import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller is admin — decode JWT locally to avoid gateway issues
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders });

    const token = authHeader.replace('Bearer ', '');
    let callerId: string | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
        callerId = payload.sub || null;
      }
    } catch { /* invalid token */ }

    if (!callerId) return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders });

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', callerId).single();
    if (callerProfile?.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { headers: corsHeaders });

    const { email, company_name, client_id } = await req.json();
    if (!email || typeof email !== 'string') return Response.json({ error: 'Email is required' }, { headers: corsHeaders });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return Response.json({ error: 'Invalid email address' }, { headers: corsHeaders });

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
          return Response.json({ error: inviteError.message }, { headers: corsHeaders });
        }

        // Send them a password reset email so they can access the portal
        await supabaseAdmin.auth.resetPasswordForEmail(email);

      } else {
        return Response.json({ error: inviteError.message }, { headers: corsHeaders });
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

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { headers: corsHeaders });
  }
});
