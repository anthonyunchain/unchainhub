import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

/**
 * AudioMessage — compact audio player for voice notes in the chat.
 *
 * Props:
 *   message  — the full message row (file_url, audio_duration, transcription)
 *   isMine   — bool, controls color scheme
 *   messageId — used to subscribe to live transcription updates
 */
export default function AudioMessage({ message, isMine, messageId }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(message.audio_duration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [transcription, setTranscription] = useState(message.transcription || null);
  const [transcribing, setTranscribing] = useState(!message.transcription && !!message.file_url);

  // Listen for real-time transcription update
  useEffect(() => {
    if (message.transcription) return;
    if (!messageId) return;

    const channel = supabase
      .channel(`transcription:${messageId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `id=eq.${messageId}`,
        },
        (payload) => {
          if (payload.new?.transcription) {
            setTranscription(payload.new.transcription);
            setTranscribing(false);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [messageId, message.transcription]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio?.duration && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  };

  const bg = isMine ? 'bg-white/20' : 'bg-accent';
  const trackBg = isMine ? 'bg-white/30' : 'bg-border';
  const fillBg = isMine ? 'bg-white' : 'bg-primary';
  const textColor = isMine ? 'text-white/80' : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px] max-w-[260px]">
      {/* Player row */}
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-xl ${bg}`}>
        <audio
          ref={audioRef}
          src={message.file_url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          preload="metadata"
          className="hidden"
        />

        {/* Play/pause button */}
        <button
          onClick={toggle}
          className={`rounded-full p-1.5 shrink-0 transition-colors ${isMine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`}
        >
          {playing
            ? <Pause className="h-3.5 w-3.5 fill-current" />
            : <Play className="h-3.5 w-3.5 fill-current" />
          }
        </button>

        {/* Progress bar */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <div
            className={`h-1.5 rounded-full cursor-pointer ${trackBg}`}
            onClick={handleSeek}
          >
            <div
              className={`h-full rounded-full transition-all ${fillBg}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={`flex justify-between text-[10px] font-mono ${textColor}`}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Transcription */}
      {transcribing && (
        <p className={`text-xs italic px-1 ${textColor} flex items-center gap-1`}>
          <span className="inline-block h-2 w-2 border border-current border-t-transparent rounded-full animate-spin" />
          Transcription…
        </p>
      )}
      {transcription && !transcribing && (
        <p className={`text-xs px-1 leading-relaxed ${isMine ? 'text-white/90' : 'text-foreground/80'}`}>
          {transcription}
        </p>
      )}
    </div>
  );
}
