import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }

    const { type = 'direct', participant_ids, name } = await req.json();

    if (!Array.isArray(participant_ids) || participant_ids.length === 0) {
      return Response.json({ error: 'participant_ids is required' }, { status: 400, headers: corsHeaders(req) });
    }

    // Determine caller role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // Groups are admin-only in v1
    if (type === 'group' && !isAdmin) {
      return Response.json({ error: 'Only admins can create group conversations' }, { status: 403, headers: corsHeaders(req) });
    }

    // Build the full participant list (always include the creator)
    const allParticipants = [...new Set([user.id, ...participant_ids])];

    if (type === 'direct') {
      if (allParticipants.length !== 2) {
        return Response.json({ error: 'Direct conversations require exactly 2 participants' }, { status: 400, headers: corsHeaders(req) });
      }

      // Deduplication: check if a direct conversation already exists between these two users
      const otherId = allParticipants.find(id => id !== user.id)!;
      const { data: existing } = await supabaseAdmin.rpc('find_direct_conversation', {
        user_a: user.id,
        user_b: otherId,
      });

      if (existing) {
        return Response.json({ conversation_id: existing }, { headers: corsHeaders(req) });
      }
    }

    // Create conversation
    const { data: conversation, error: convErr } = await supabaseAdmin
      .from('conversations')
      .insert({ type, name: type === 'group' ? name : null, created_by: user.id })
      .select()
      .single();

    if (convErr || !conversation) {
      return Response.json({ error: convErr?.message || 'Failed to create conversation' }, { status: 500, headers: corsHeaders(req) });
    }

    // Add all participants
    const participantRows = allParticipants.map(uid => ({
      conversation_id: conversation.id,
      user_id: uid,
    }));

    const { error: partErr } = await supabaseAdmin
      .from('conversation_participants')
      .insert(participantRows);

    if (partErr) {
      return Response.json({ error: partErr.message }, { status: 500, headers: corsHeaders(req) });
    }

    return Response.json({ conversation_id: conversation.id }, { headers: corsHeaders(req) });

  } catch (error) {
    console.error('[createConversation] CATCH:', error?.message, error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});
