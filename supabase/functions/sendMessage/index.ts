import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { sendPush } from '../_shared/pushNotify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult as { user: any };

    // Staff accounts don't have messaging access.
    const { data: senderRole } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (senderRole?.role === 'staff') {
      return respond({ error: 'Messaging is not available for staff accounts.' }, 403);
    }

    const {
      conversation_id,
      content = '',
      message_type = 'text',
      file_url = null,
      file_name = null,
      reply_to_id = null,
    } = await req.json();

    if (!conversation_id) return respond({ error: 'conversation_id required' }, 400);
    if (!content && !file_url) return respond({ error: 'Empty message' }, 400);

    // Verify the sender is a participant of this conversation.
    const { data: participant } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversation_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!participant) {
      return respond({ error: 'Not a participant of this conversation' }, 403);
    }

    // Insert the message
    const { data: message, error: insertErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id,
        sender_id: user.id,
        content: String(content || ''),
        message_type,
        file_url,
        file_name,
        reply_to_id,
      })
      .select()
      .single();

    if (insertErr || !message) {
      return respond({ error: insertErr?.message || 'Failed to insert message' }, 500);
    }

    // Fire push to every other participant — non-blocking.
    queueMicrotask(async () => {
      try {
        const { data: parts } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversation_id);
        const recipientIds = (parts || []).map(p => p.user_id).filter(id => id !== user.id);
        if (!recipientIds.length) return;

        const { data: senderProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();

        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('type, name')
          .eq('id', conversation_id)
          .maybeSingle();

        const senderName = senderProfile?.full_name || user.email?.split('@')[0] || 'Someone';
        const preview = message_type === 'text'
          ? (String(content || '').slice(0, 140))
          : (file_name || (message_type === 'image' ? '📎 Image' : '📎 File'));
        const title = conv?.type === 'group' && conv?.name
          ? `💬 ${senderName} · ${conv.name}`
          : `💬 ${senderName}`;

        await sendPush(supabaseAdmin, {
          title,
          body: preview,
          url: '/Messages',
          user_ids: recipientIds,
        });
      } catch (pushErr) {
        console.error('[sendMessage] push non-fatal:', (pushErr as Error)?.message);
      }
    });

    return respond({ message });
  } catch (err) {
    console.error('[sendMessage]', (err as Error)?.message);
    return respond({ error: (err as Error)?.message || 'Exception' }, 500);
  }
});
