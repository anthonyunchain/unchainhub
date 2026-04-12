import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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

    const { email, company_name, client_id, password: inputPassword } = await req.json();
    if (!email || typeof email !== 'string') return Response.json({ error: 'Email is required' }, { headers: corsHeaders });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return Response.json({ error: 'Invalid email address' }, { headers: corsHeaders });

    const password = inputPassword || generatePassword();

    // Check if user already exists
    const adminUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`;
    const adminResp = await fetch(adminUrl, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
    });
    const adminData = await adminResp.json();
    const existingUserId: string | null = adminData?.users?.[0]?.id || null;

    let userId: string;

    if (existingUserId) {
      // Update existing user's password (solves the "already registered" problem)
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      });
      if (updateErr) return Response.json({ error: updateErr.message }, { headers: corsHeaders });
      userId = existingUserId;
    } else {
      // Create new user with confirmed email
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { company_name, role: 'client' },
      });
      if (createErr) return Response.json({ error: createErr.message }, { headers: corsHeaders });
      userId = createData.user.id;
    }

    // Set profile role to client
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: company_name || email,
      role: 'client',
    }, { onConflict: 'id' });

    // Link to client record
    if (client_id) {
      await supabaseAdmin.from('clients').update({ portal_user_id: userId }).eq('id', client_id);
    }

    return Response.json({ success: true, password }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { headers: corsHeaders });
  }
});
