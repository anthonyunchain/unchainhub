import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const MAX_SECONDS = 300; // 5 min cap

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * VoiceRecorder — inline recorder that appears inside MessageInput.
 *
 * Props:
 *   onSend({ file_url, file_name, audio_duration }) — called with upload result
 *   onCancel() — called when user discards the recording
 *   disabled — disables send while parent is busy
 */
export default function VoiceRecorder({ onSend, onCancel, disabled }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | preview | uploading
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [waveform, setWaveform] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const drawWaveform = useCallback((analyser) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      // Sample 30 bars
      const step = Math.floor(data.length / 30);
      const bars = Array.from({ length: 30 }, (_, i) => data[i * step] / 255);
      setWaveform(bars);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType });
        setBlob(recorded);
        setAudioUrl(URL.createObjectURL(recorded));
        stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        setWaveform([]);
        setPhase('preview');
      };

      mr.start(100);
      setPhase('recording');
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) {
            mr.stop();
            clearInterval(timerRef.current);
          }
          return s + 1;
        });
      }, 1000);

      drawWaveform(analyser);
    } catch (err) {
      console.error('[VoiceRecorder] mic access denied:', err);
    }
  }, [drawWaveform]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const discard = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current?.stop();
    setPhase('idle');
    setSeconds(0);
    setBlob(null);
    setAudioUrl(null);
    setWaveform([]);
    onCancel?.();
  }, [onCancel]);

  const sendAudio = useCallback(async () => {
    if (!blob) return;
    setPhase('uploading');

    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `voice-${Date.now()}.${ext}`;
      const filePath = `audio/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from('messages')
        .upload(filePath, blob, { contentType: blob.type, upsert: false });

      if (upErr) throw new Error(upErr.message);

      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(filePath);

      onSend({ file_url: publicUrl, file_name: fileName, audio_duration: seconds });

      // Cleanup local state
      setPhase('idle');
      setSeconds(0);
      setBlob(null);
      setAudioUrl(null);
    } catch (err) {
      console.error('[VoiceRecorder] upload failed:', err);
      setPhase('preview');
    }
  }, [blob, seconds, onSend]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Note vocale"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex-1">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-xs font-mono text-red-600 dark:text-red-400 w-10 shrink-0">
          {formatTime(seconds)}
        </span>

        {/* Live waveform */}
        <div className="flex items-center gap-0.5 flex-1 h-6">
          {waveform.map((v, i) => (
            <div
              key={i}
              className="bg-red-400 dark:bg-red-500 rounded-full w-1 transition-all duration-75"
              style={{ height: `${Math.max(4, v * 24)}px` }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={discard}
          className="text-muted-foreground hover:text-red-600 transition-colors p-1"
          title="Annuler"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={stopRecording}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
          title="Arrêter"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    );
  }

  if (phase === 'preview') {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-accent/50 border border-border rounded-xl flex-1">
        <audio src={audioUrl} controls className="h-8 flex-1 min-w-0" style={{ maxWidth: '200px' }} />
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {formatTime(seconds)}
        </span>
        <button
          type="button"
          onClick={discard}
          className="text-muted-foreground hover:text-destructive transition-colors p-1"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Button
          type="button"
          size="sm"
          onClick={sendAudio}
          disabled={disabled}
          className="h-8 px-3 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (phase === 'uploading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
        Envoi…
      </div>
    );
  }

  return null;
}
