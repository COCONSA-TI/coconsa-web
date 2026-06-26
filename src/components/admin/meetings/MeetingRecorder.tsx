'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { MeetingMinutes } from '@/types/database';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface MeetingRecorderProps {
  meetingId: string;
  meetingTitle: string;
  onMinutesGenerated: (minutes: MeetingMinutes) => void;
  onStatusChange?: (status: 'in_progress' | 'completed') => void;
}

// ─── Web Speech API type augmentation ────────────────────────────────────────

// Web Speech API — no está en el lib.dom estándar de todos los tsconfig
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function calculateAudioLevels(dataArray: Uint8Array, bufferLength: number): number[] {
  const step = Math.floor(bufferLength / 20);
  const levels = [];
  for (let i = 0; i < 20; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += dataArray[i * step + j];
    }
    const avg = sum / step;
    levels.push(Math.max(3, (avg / 255) * 40));
  }
  return levels;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MeetingRecorder({
  meetingId,
  meetingTitle,
  onMinutesGenerated,
  onStatusChange
}: MeetingRecorderProps) {
  // States
  const [recorderState, setRecorderState] = useState<'idle' | 'recording' | 'paused' | 'stopped' | 'generating'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioSize, setAudioSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(20).fill(3));
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechFallback, setSpeechFallback] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const transcriptRef = useRef('');
  const startTimeRef = useRef<Date | null>(null);
  const recognitionFailuresRef = useRef(0);
  const MAX_RECOGNITION_FAILURES = 3;

  // Keep transcriptRef in sync for use inside recognition callbacks
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // ── Audio level animation ─────────────────────────────────────────────────

  const animateAudioLevels = useCallback(() => {
    if (!analyserRef.current || recorderState === 'paused') return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    setAudioLevels(calculateAudioLevels(dataArray, bufferLength));
    animFrameRef.current = requestAnimationFrame(animateAudioLevels);
  }, [recorderState]);

  // ── Start recording ───────────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio Context para visualizador
      const audioCtx = new window.AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      analyserRef.current = analyser;
      audioContextRef.current = audioCtx;

      // MediaRecorder para guardar el audio
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      setAudioSize(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          setAudioSize(audioChunksRef.current.reduce((a, b) => a + b.size, 0));
        }
      };
      recorder.start(1000); // chunk cada segundo
      mediaRecorderRef.current = recorder;

      // Web Speech API para transcripción en tiempo real
      const SpeechRecognitionClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        recognitionFailuresRef.current = 0;

        const recognition = new SpeechRecognitionClass();
        recognition.lang = 'es-MX';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          recognitionFailuresRef.current = 0;
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              setTranscript(prev => prev + result[0].transcript + ' ');
            } else {
              interim += result[0].transcript;
            }
          }
          setInterimTranscript(interim);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') return;

          recognitionFailuresRef.current += 1;
          console.warn(`[Speech recognition error] ${event.error} (fallo ${recognitionFailuresRef.current}/${MAX_RECOGNITION_FAILURES})`);

          if (recognitionFailuresRef.current >= MAX_RECOGNITION_FAILURES) {
            setSpeechFallback(true);
            recognitionRef.current = null;
          }
        };

        recognition.onend = () => {
          const stillRecording = mediaRecorderRef.current?.state === 'recording';
          const underFailureLimit = recognitionFailuresRef.current < MAX_RECOGNITION_FAILURES;
          if (stillRecording && underFailureLimit) {
            setTimeout(() => {
              try {
                if (mediaRecorderRef.current?.state === 'recording') {
                  recognition.start();
                }
              } catch {
                // ignorar si ya arrancó
              }
            }, 300);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }

      // Timer
      startTimeRef.current = new Date();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      // Animación
      animateAudioLevels();

      setRecorderState('recording');
      onStatusChange?.('in_progress');

      // Actualizar estado de la reunión en BD
      await fetch(`/api/v1/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error(e);
      setError('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
    }
  };

  // ── Pause / Resume ────────────────────────────────────────────────────────

  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (recorderState === 'recording') {
      mediaRecorderRef.current.pause();
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setAudioLevels(Array(20).fill(3));
      setRecorderState('paused');
    } else if (recorderState === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      animateAudioLevels();
      try { recognitionRef.current?.start(); } catch { /* already running */ }
      setRecorderState('recording');
    }
  }, [recorderState, animateAudioLevels]);

  // ── Stop recording ────────────────────────────────────────────────────────

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    // Detener todo
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevels(Array(20).fill(3));
    setInterimTranscript('');

    // Agregar texto interim pendiente a la transcripción
    if (interimTranscript) {
      setTranscript(prev => prev + interimTranscript + ' ');
    }

    setRecorderState('stopped');

    // Guardar ended_at y duration en BD
    await fetch(`/api/v1/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      }),
    });

    // Subir audio en background
    uploadAudio();
  }, [meetingId, duration, interimTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload audio ──────────────────────────────────────────────────────────

  const uploadAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    setUploadProgress('uploading');
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, `recording_${meetingId}.webm`);

    try {
      const res = await fetch(`/api/v1/meetings/${meetingId}/audio`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      setUploadProgress(res.ok ? 'done' : 'error');
    } catch {
      setUploadProgress('error');
    }
  }, [meetingId]);

  // ── Generate minutes ──────────────────────────────────────────────────────

  const generateMinutes = useCallback(async () => {
    const finalTranscript = transcriptRef.current.trim();
    if (!finalTranscript && uploadProgress !== 'done') {
      setError('No hay transcripción disponible y el audio aún no se sube o falló.');
      return;
    }

    setRecorderState('generating');
    setError(null);

    try {
      // Guardar la transcripción final primero
      await fetch(`/api/v1/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transcript: finalTranscript }),
      });

      const res = await fetch(`/api/v1/meetings/${meetingId}/generate-minutes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transcript: finalTranscript }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al generar la minuta');
      }

      if (data.transcribedByAI && data.transcript) {
        setTranscript(data.transcript);
      }

      onMinutesGenerated(data.minutes);
      onStatusChange?.('completed');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error desconocido al generar la minuta');
      setRecorderState('stopped'); // Permitir reintentar
    }
  }, [meetingId, uploadProgress, onMinutesGenerated, onStatusChange]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  const isRecording = recorderState === 'recording';
  const isPaused = recorderState === 'paused';
  const isStopped = recorderState === 'stopped';
  const isGenerating = recorderState === 'generating';

  return (
    <div className="meeting-recorder">
      <div className="recorder-header">
        <div className="recorder-title-section">
          <div className={`status-dot ${isRecording ? 'recording' : isPaused ? 'paused' : ''}`} />
          <h2>Grabación de la reunión</h2>
        </div>
        <div className="recorder-timer">
          {formatTime(duration)}
          {audioSize > 0 && <span className="audio-size">({(audioSize / 1024 / 1024).toFixed(1)} MB)</span>}
        </div>
      </div>

      {error && (
        <div className="recorder-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {recorderState === 'idle' && (
        <div className="start-prompt">
          <button id="btn-start-record" className="btn-record btn-record-start" onClick={startRecording}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Comenzar Grabación
          </button>
          <p>La IA transcribirá la reunión en tiempo real y generará una minuta al finalizar.</p>
        </div>
      )}

      {(isRecording || isPaused) && (
        <div className="active-recording-panel">
          <div className="recording-controls">
            <button className="btn-icon" onClick={togglePause} title={isRecording ? 'Pausar' : 'Reanudar'}>
              {isRecording ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              )}
            </button>
            <button className="btn-icon btn-icon-danger" onClick={stopRecording} title="Detener y finalizar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          </div>
          <div className={`waveform ${isPaused ? 'waveform-paused' : ''}`}>
            {audioLevels.map((h, i) => (
              <div
                key={i}
                className="waveform-bar"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          {!speechSupported && (
            <div className="speech-warning">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span>Transcripción en tiempo real no disponible en tu navegador. Se usará Gemini al finalizar.</span>
            </div>
          )}
          {speechSupported && speechFallback && (
            <div className="speech-warning speech-warning-network">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
              <span>La transcripción en vivo falló por conexión. El audio se sigue grabando — Gemini generará la transcripción al finalizar.</span>
            </div>
          )}
        </div>
      )}

      {/* Panel de transcripción en vivo */}
      {(transcript || isRecording || isPaused || isStopped) && (
        <div className="transcript-panel">
          <div className="transcript-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3>Transcripción {isRecording ? 'en vivo' : ''}</h3>
          </div>
          <textarea
            className="transcript-textarea"
            value={transcript + (interimTranscript ? `\n${interimTranscript}...` : '')}
            onChange={e => setTranscript(e.target.value)}
            placeholder="La transcripción aparecerá aquí..."
            disabled={isRecording || isGenerating}
          />
        </div>
      )}

      {/* Final Actions */}
      <div className="actions-panel">
        {isStopped && uploadProgress === 'uploading' && (
          <div className="upload-indicator">
            <div className="upload-spinner" />
            <span>Subiendo archivo de audio ({(audioSize / 1024 / 1024).toFixed(1)} MB)... por favor espera.</span>
          </div>
        )}

        {isStopped && (
          <button
            id="btn-generate-minutes"
            className="btn-record btn-record-generate"
            onClick={generateMinutes}
            disabled={(!transcript.trim() && uploadProgress !== 'done') || uploadProgress === 'uploading'}
            title={uploadProgress === 'uploading' ? 'Espera a que termine de subir el audio' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {!transcript.trim() && uploadProgress === 'done' 
              ? 'Transcribir y Generar Minuta con IA' 
              : 'Generar Minuta con IA'}
          </button>
        )}

        {isGenerating && (
          <div className="generating-indicator">
            <div className="generating-spinner" />
            <div className="generating-text">
              <span>
                {!transcript.trim() 
                  ? 'Gemini está transcribiendo el audio (puede tardar un minuto)...' 
                  : 'Gemini está analizando la transcripción...'}
              </span>
              <span className="generating-sub">No cierres esta pestaña</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .meeting-recorder {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Header */
        .recorder-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .recorder-title-section {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #cbd5e1;
        }
        .status-dot.recording {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
          animation: pulse-red 2s infinite;
        }
        .status-dot.paused {
          background: #f59e0b;
        }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .recorder-title-section h2 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .recorder-timer {
          font-family: monospace;
          font-size: 1.25rem;
          font-weight: 700;
          color: #334155;
          background: #f8fafc;
          padding: 0.4rem 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .audio-size {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 500;
        }

        /* Error */
        .recorder-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem;
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          border-radius: 0.875rem;
          font-size: 0.875rem;
        }

        /* Start Prompt */
        .start-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 3rem 1.5rem;
          background: #f8fafc;
          border: 2px dashed #cbd5e1;
          border-radius: 1.25rem;
          text-align: center;
        }
        .start-prompt p {
          margin: 0;
          color: #64748b;
          font-size: 0.9rem;
          max-width: 300px;
        }

        /* Buttons */
        .btn-record {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.75rem;
          border: none;
          border-radius: 9999px;
          font-size: 1rem;
          font-weight: 700;
          color: white;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .btn-record-start {
          background: #ef4444;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
        }
        .btn-record-start:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }
        .btn-record-generate {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          box-shadow: 0 4px 15px rgba(124,58,237,0.3);
          width: 100%;
          justify-content: center;
        }
        .btn-record-generate:hover:not(:disabled) { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .btn-record-generate:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Upload Indicator */
        .upload-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 0.75rem;
          color: #2563eb;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .upload-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(37, 99, 235, 0.3);
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Generating Indicator */
        .generating-indicator {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: linear-gradient(135deg, #faf5ff, #f5f3ff);
          border: 1px solid #e9d5ff;
          border-radius: 1rem;
        }
        .generating-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(124, 58, 237, 0.2);
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .generating-text {
          display: flex;
          flex-direction: column;
          color: #5b21b6;
          font-weight: 600;
          font-size: 0.95rem;
        }
        .generating-sub {
          font-size: 0.75rem;
          color: #7c3aed;
          font-weight: 400;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Active recording panel */
        .active-recording-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          padding: 2rem 1.5rem;
          background: #f8fafc;
          border-radius: 1.25rem;
          border: 1px solid #e2e8f0;
        }
        .recording-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .btn-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
          background: white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          transition: all 0.2s;
        }
        .btn-icon:hover {
          color: #1e293b;
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0,0,0,0.1);
        }
        .btn-icon-danger {
          color: #ef4444;
        }
        .btn-icon-danger:hover {
          background: #ef4444;
          color: white;
        }

        /* Waveform */
        .waveform {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 40px;
          padding: 0 1rem;
        }
        .waveform-bar {
          width: 6px;
          background: #3b82f6;
          border-radius: 3px;
          transition: height 0.05s ease;
        }
        .waveform-paused .waveform-bar {
          background: #cbd5e1;
          height: 4px !important;
          transition: height 0.3s ease;
        }
        
        .speech-warning {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #f59e0b;
          text-align: center;
          margin: 0;
          line-height: 1.4;
        }
        .speech-warning-network {
          color: #fb923c;
          background: rgba(251, 146, 60, 0.1);
          padding: 0.5rem 0.875rem;
          border-radius: 0.5rem;
        }

        /* Transcript panel */
        .transcript-panel {
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          overflow: hidden;
          background: white;
        }
        .transcript-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
        }
        .transcript-header h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin: 0;
        }
        .transcript-textarea {
          width: 100%;
          min-height: 200px;
          border: none;
          padding: 1rem;
          font-size: 0.875rem;
          line-height: 1.6;
          color: #334155;
          font-family: inherit;
          resize: vertical;
          outline: none;
          background: transparent;
        }
        .transcript-textarea:disabled {
          background: #f8fafc;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
