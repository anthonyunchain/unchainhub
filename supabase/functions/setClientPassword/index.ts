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

    // Verify caller is admin — decode JWT manually
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

    // Find existing user by paginating through all users
    let existingUserId: string | null = null;
    let page = 1;
    while (true) {
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr || !listData?.users?.length) break;
      const found = listData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) { existingUserId = found.id; break; }
      if (listData.users.length < 1000) break;
      page++;
    }

    let userId: string;

    if (existingUserId) {
      // Update password for existing user
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      });
      if (updateErr) return Response.json({ error: updateErr.message }, { headers: corsHeaders });
      userId = existingUserId;
    } else {
      // Create new user
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

    return Response.json({ success: true, password, email }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { headers: corsHeaders });
  }
});
