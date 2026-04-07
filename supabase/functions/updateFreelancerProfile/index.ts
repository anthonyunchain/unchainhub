import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fields a freelancer is allowed to update on their own profile
const ALLOWED_FIELDS = ['name', 'role', 'status', 'notes', 'phone', 'avatar_url', 'specialties'];
const ALLOWED_STATUSES = ['Actif', 'Indisponible'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Resolve freelancer ID from JWT email — never trust client-provided ID
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id')
      .eq('email', user.email)
      .limit(1);

    const freelancerId = freelancers?.[0]?.id;
    if (!freelancerId) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json();

    // Whitelist: only allow safe fields, reject everything else
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400, headers: corsHeaders });
    }

    // Validate status if provided
    if (updates.status && !ALLOWED_STATUSES.includes(updates.status as string)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400, headers: corsHeaders });
    }

    // Validate string lengths
    if (typeof updates.name === 'string' && updates.name.length > 100) {
      return Response.json({ error: 'name too long' }, { status: 400, headers: corsHeaders });
    }
    if (typeof updates.notes === 'string' && updates.notes.length > 2000) {
      return Response.json({ error: 'notes too long' }, { status: 400, headers: corsHeaders });
    }
    if (typeof updates.phone === 'string' && updates.phone.length > 30) {
      return Response.json({ error: 'phone too long' }, { status: 400, headers: corsHeaders });
    }

    // Update only this freelancer's own record (ID resolved from JWT, not from client)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('freelancers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', freelancerId)
      .select()
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true, profile: updated }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
