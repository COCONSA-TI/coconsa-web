'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import MeetingRecorder from '@/components/admin/meetings/MeetingRecorder';
import MinuteViewer from '@/components/admin/meetings/MinuteViewer';
import type { Meeting, MeetingMinutes } from '@/types/database';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function MeetingDetailPage() {
  const { loading: authLoading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const meetingId = params?.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [activeTab, setActiveTab] = useState<'grabar' | 'minuta' | 'transcripcion'>('grabar');
  const [downloadingAudio, setDownloadingAudio] = useState(false);

  const fetchMeeting = async () => {
    try {
      const res = await fetch(`/api/v1/meetings/${meetingId}`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMeeting(data.meeting);
        if (data.meeting.minutes_structured) {
          setMinutes(data.meeting.minutes_structured);
          setActiveTab('minuta');
        } else if (data.meeting.status === 'completed') {
          setActiveTab('transcripcion');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && meetingId) fetchMeeting();
  }, [authLoading, meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMinutesGenerated = (newMinutes: MeetingMinutes) => {
    setMinutes(newMinutes);
    setActiveTab('minuta');
  };

  const handleStatusChange = (status: 'in_progress' | 'completed') => {
    setMeeting(prev => prev ? { ...prev, status } : null);
  };

  const handleMeetingUpdate = (updated: Meeting) => {
    setMeeting(updated);
    if (updated.minutes_structured) {
      setMinutes(updated.minutes_structured);
    }
  };

  const handleDownloadAudio = async () => {
    setDownloadingAudio(true);
    try {
      const res = await fetch(`/api/v1/meetings/${meetingId}/audio`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank');
      }
    } finally {
      setDownloadingAudio(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="detail-page">
        <div className="skeleton-header" />
        <div className="skeleton-body" />
      </div>
    );
  }

  if (notFound || !meeting) {
    return (
      <div className="detail-page">
        <div className="not-found">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
          <h2>Reunión no encontrada</h2>
          <p>Esta reunión no existe o no tienes permiso para verla.</p>
          <button onClick={() => router.push('/dashboard/reuniones')} className="btn-back">
            Volver a Reuniones
          </button>
        </div>
      </div>
    );
  }

  const STATUS_COLORS = {
    draft: { bg: '#f1f5f9', color: '#64748b', label: 'Borrador' },
    in_progress: { bg: '#fef3c7', color: '#d97706', label: 'En progreso' },
    completed: { bg: '#dcfce7', color: '#16a34a', label: 'Completada' },
  };
  const statusStyle = STATUS_COLORS[meeting.status] ?? STATUS_COLORS.draft;

  const tabs = [
    {
      key: 'grabar' as const,
      label: 'Grabar',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      ),
      disabled: meeting.status === 'completed',
    },
    {
      key: 'minuta' as const,
      label: 'Minuta',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      disabled: !minutes,
      badge: minutes ? 'IA' : undefined,
    },
    {
      key: 'transcripcion' as const,
      label: 'Transcripción',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      disabled: !meeting.transcript,
    },
  ];

  return (
    <div className="detail-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <button onClick={() => router.push('/dashboard/reuniones')} className="breadcrumb-link">
          Reuniones
        </button>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="breadcrumb-current">{meeting.title}</span>
      </nav>

      {/* Meeting header */}
      <div className="meeting-header">
        <div className="meeting-header-main">
          <div className="meeting-title-row">
            <h1 className="meeting-title">{meeting.title}</h1>
            <span
              className="meeting-status"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {statusStyle.label}
            </span>
          </div>
          {meeting.description && (
            <p className="meeting-desc">{meeting.description}</p>
          )}
        </div>

        {/* Metadata chips */}
        <div className="meeting-meta">
          {meeting.started_at && (
            <span className="meta-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {formatDate(meeting.started_at)}
            </span>
          )}
          {meeting.duration_seconds && (
            <span className="meta-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatDuration(meeting.duration_seconds)}
            </span>
          )}
          {meeting.attendees.length > 0 && (
            <span className="meta-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {meeting.attendees.join(', ')}
            </span>
          )}
          {meeting.audio_path && (
            <button
              className="meta-chip meta-chip-audio"
              onClick={handleDownloadAudio}
              disabled={downloadingAudio}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloadingAudio ? 'Preparando...' : 'Descargar audio'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && <span className="tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {activeTab === 'grabar' && (
            <MeetingRecorder
              meetingId={meeting.id}
              meetingTitle={meeting.title}
              onMinutesGenerated={handleMinutesGenerated}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeTab === 'minuta' && minutes && (
            <MinuteViewer
              meeting={meeting}
              minutes={minutes}
              onUpdate={handleMeetingUpdate}
            />
          )}

          {activeTab === 'transcripcion' && meeting.transcript && (
            <div className="transcript-view">
              <div className="transcript-view-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Transcripción completa</span>
                <span className="transcript-words">
                  {meeting.transcript.split(/\s+/).filter(Boolean).length} palabras
                </span>
              </div>
              <div className="transcript-body">
                <p>{meeting.transcript}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .detail-page {
          padding: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Skeleton */
        .skeleton-header {
          height: 140px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          border-radius: 1rem;
          animation: shimmer 1.4s infinite;
        }
        .skeleton-body {
          height: 400px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          border-radius: 1rem;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Not found */
        .not-found {
          text-align: center;
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: #94a3b8;
        }
        .not-found h2 { color: #1e293b; margin: 0; font-size: 1.25rem; }
        .not-found p { color: #64748b; margin: 0; }
        .btn-back {
          padding: 0.625rem 1.25rem;
          background: #1e293b;
          color: white;
          border: none;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }
        .btn-back:hover { background: #0f172a; }

        /* Breadcrumb */
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.82rem;
          color: #94a3b8;
        }
        .breadcrumb-link {
          background: none;
          border: none;
          cursor: pointer;
          color: #7c3aed;
          font-size: 0.82rem;
          font-family: inherit;
          padding: 0;
          font-weight: 500;
          transition: opacity 0.15s;
        }
        .breadcrumb-link:hover { opacity: 0.75; }
        .breadcrumb-current {
          color: #1e293b;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }

        /* Meeting header */
        .meeting-header {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1.25rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .meeting-title-row {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .meeting-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
          flex: 1;
          min-width: 0;
        }
        .meeting-status {
          padding: 0.3rem 0.875rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .meeting-desc {
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }
        .meeting-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .meta-chip {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.3rem 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #475569;
          font-weight: 500;
        }
        .meta-chip-audio {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #2563eb;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .meta-chip-audio:hover:not(:disabled) {
          background: #dbeafe;
        }
        .meta-chip-audio:disabled { opacity: 0.7; cursor: wait; }

        /* Tabs */
        .tabs-container {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1.25rem;
          overflow: hidden;
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.875rem 0.5rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          position: relative;
        }
        .tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #7c3aed;
          transform: scaleX(0);
          transition: transform 0.15s;
        }
        .tab.active {
          color: #7c3aed;
          background: white;
        }
        .tab.active::after { transform: scaleX(1); }
        .tab.disabled { opacity: 0.4; cursor: not-allowed; }
        .tab-badge {
          padding: 0.1rem 0.35rem;
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          color: white;
          border-radius: 9999px;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .tab-content {
          padding: 1.5rem;
        }

        /* Transcript view */
        .transcript-view {
          border: 1px solid #e2e8f0;
          border-radius: 0.875rem;
          overflow: hidden;
        }
        .transcript-view-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.8rem;
          font-weight: 600;
          color: #475569;
        }
        .transcript-words {
          margin-left: auto;
          font-size: 0.72rem;
          background: #f1f5f9;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          color: #64748b;
          font-weight: 400;
        }
        .transcript-body {
          padding: 1.25rem;
          max-height: 500px;
          overflow-y: auto;
        }
        .transcript-body p {
          font-size: 0.875rem;
          line-height: 1.8;
          color: #334155;
          margin: 0;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}
