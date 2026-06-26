'use client';

import type { Meeting } from '@/types/database';

interface MeetingCardProps {
  meeting: Meeting;
  onClick: () => void;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return null!;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: '#64748b', bg: '#f1f5f9' },
  in_progress: { label: 'En progreso', color: '#d97706', bg: '#fef3c7' },
  completed: { label: 'Completada', color: '#16a34a', bg: '#dcfce7' },
};

export default function MeetingCard({ meeting, onClick }: MeetingCardProps) {
  const status = STATUS_CONFIG[meeting.status] ?? STATUS_CONFIG.draft;
  const hasMinutes = !!meeting.minutes_structured;
  const hasAudio = !!meeting.audio_path;
  const duration = formatDuration(meeting.duration_seconds);
  const wordCount = meeting.transcript
    ? meeting.transcript.split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <button
      id={`meeting-card-${meeting.id}`}
      className="meeting-card"
      onClick={onClick}
    >
      {/* Status badge */}
      <div className="mc-header">
        <span
          className="mc-status-badge"
          style={{ color: status.color, background: status.bg }}
        >
          <span className="mc-status-dot" style={{ background: status.color }} />
          {status.label}
        </span>
        <span className="mc-date">{formatDate(meeting.created_at)}</span>
      </div>

      {/* Title */}
      <h3 className="mc-title">{meeting.title}</h3>

      {/* Description */}
      {meeting.description && (
        <p className="mc-description">{meeting.description}</p>
      )}

      {/* Attendees */}
      {meeting.attendees.length > 0 && (
        <div className="mc-attendees">
          {meeting.attendees.slice(0, 3).map((a, i) => (
            <span key={i} className="mc-attendee-chip">{a}</span>
          ))}
          {meeting.attendees.length > 3 && (
            <span className="mc-attendee-more">+{meeting.attendees.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mc-footer">
        <div className="mc-meta">
          {duration && (
            <span className="mc-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {duration}
            </span>
          )}
          {wordCount > 0 && (
            <span className="mc-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {wordCount} palabras
            </span>
          )}
        </div>
        <div className="mc-indicators">
          {hasAudio && (
            <span className="mc-indicator mc-indicator-audio" title="Audio guardado">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </span>
          )}
          {hasMinutes && (
            <span className="mc-indicator mc-indicator-minutes" title="Minuta generada">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              IA
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .meeting-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          text-align: left;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }
        .meeting-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #7c3aed, #6366f1);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .meeting-card:hover {
          border-color: #c4b5fd;
          box-shadow: 0 8px 25px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .meeting-card:hover::before { opacity: 1; }

        .mc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .mc-status-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 600;
        }
        .mc-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .mc-date {
          font-size: 0.72rem;
          color: #94a3b8;
        }

        .mc-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .mc-description {
          font-size: 0.8rem;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .mc-attendees {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }
        .mc-attendee-chip {
          padding: 0.15rem 0.5rem;
          background: #f1f5f9;
          border-radius: 9999px;
          font-size: 0.7rem;
          color: #475569;
          font-weight: 500;
        }
        .mc-attendee-more {
          padding: 0.15rem 0.5rem;
          background: #e2e8f0;
          border-radius: 9999px;
          font-size: 0.7rem;
          color: #64748b;
        }

        .mc-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding-top: 0.625rem;
          border-top: 1px solid #f1f5f9;
        }
        .mc-meta {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .mc-meta-item {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.72rem;
          color: #94a3b8;
        }
        .mc-indicators {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .mc-indicator {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 700;
        }
        .mc-indicator-audio {
          background: #eff6ff;
          color: #2563eb;
        }
        .mc-indicator-minutes {
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          color: white;
        }
      `}</style>
    </button>
  );
}
