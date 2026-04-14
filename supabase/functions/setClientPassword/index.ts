import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller via Supabase SDK (not manual JWT decode)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });

    // Admin-only
    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (callerProfile?.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403, headers: corsHeaders(req) });

    const { email, company_name, client_id, password: inputPassword } = await req.json();
    if (!email || typeof email !== 'string') return Response.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders(req) });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return Response.json({ error: 'Invalid email address' }, { status: 400, headers: corsHeaders(req) });

    const password = inputPassword || generatePassword();

    // Look up existing user by email via admin REST API (no full user list scan)
    const adminUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`;
    const adminResp = await fetch(adminUrl, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      }
    });
    const adminData = await adminResp.json();
    const existingUserId: string | null = adminData?.users?.[0]?.id || null;

    let userId: string;

    if (existingUserId) {
      // Update password for existing user
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      });
      if (updateErr) return Response.json({ error: updateErr.message }, { status: 400, headers: corsHeaders(req) });
      userId = existingUserId;
    } else {
      // Create new user
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { company_name, role: 'client' },
      });
      if (createErr) return Response.json({ error: createErr.message }, { status: 400, headers: corsHeaders(req) });
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

    return Response.json({ success: true, password, email }, { headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
