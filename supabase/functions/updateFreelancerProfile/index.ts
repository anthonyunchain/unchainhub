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
      return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { headers: corsHeaders });
    }

    // Resolve freelancer ID from JWT email — never trust client-provided ID
    const { data: freelancers } = await supabaseAdmin
      .from('freelancers')
      .select('id')
      .eq('email', user.email)
      .limit(1);

    const freelancerId = freelancers?.[0]?.id;
    if (!freelancerId) {
      return Response.json({ error: 'No freelancer profile found for this account.' }, { headers: corsHeaders });
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
      return Response.json({ error: 'No valid fields to update' }, { headers: corsHeaders });
    }

    // Validate status if provided
    if (updates.status && !ALLOWED_STATUSES.includes(updates.status as string)) {
      return Response.json({ error: 'Invalid status value' }, { headers: corsHeaders });
    }

    // Update only this freelancer's own record (ID resolved from JWT, not from client)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('freelancers')
      .update(updates)
      .eq('id', freelancerId)
      .select()
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { headers: corsHeaders });
    }

    return Response.json({ success: true, profile: updated }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: error.message }, { headers: corsHeaders });
  }
});
