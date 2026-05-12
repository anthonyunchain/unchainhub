import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authResult = await verifyAuth(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;

    const { message_id, file_url } = await req.json();
    if (!message_id || !file_url) {
      return respond({ error: 'message_id and file_url required' }, 400);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return respond({ error: 'OpenAI not configured' }, 503);

    // Download the audio file from Supabase storage
    const audioRes = await fetch(file_url);
    if (!audioRes.ok) return respond({ error: 'Could not fetch audio file' }, 400);
    const audioBlob = await audioRes.blob();

    // Determine file extension from URL for Whisper (needs a filename with extension)
    const ext = file_url.split('?')[0].split('.').pop() || 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      mp4: 'audio/mp4',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
    };
    const mime = mimeMap[ext] || 'audio/webm';

    // Send to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', new File([audioBlob], `audio.${ext}`, { type: mime }));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error('[transcribeAudio] Whisper error:', err);
      return respond({ error: 'Transcription failed' }, 500);
    }

    const { text: transcription } = await whisperRes.json();

    // Persist transcription on the message
    const { error: updateErr } = await supabaseAdmin
      .from('messages')
      .update({ transcription })
      .eq('id', message_id);

    if (updateErr) {
      console.error('[transcribeAudio] update error:', updateErr.message);
      return respond({ error: updateErr.message }, 500);
    }

    return respond({ transcription });
  } catch (err) {
    console.error('[transcribeAudio]', (err as Error)?.message);
    return respond({ error: (err as Error)?.message || 'Exception' }, 500);
  }
});
