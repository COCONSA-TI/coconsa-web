'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import MeetingCard from '@/components/admin/meetings/MeetingCard';
import NewMeetingModal from '@/components/admin/meetings/NewMeetingModal';
import { useRouter } from 'next/navigation';
import type { Meeting, MeetingStatus } from '@/types/database';

type FilterStatus = 'all' | MeetingStatus;

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'draft', label: 'Borradores' },
];

export default function ReunionesPage() {
  const { loading: authLoading } = useRequireAuth();
  const router = useRouter();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showModal, setShowModal] = useState(false);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/v1/meetings?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchMeetings();
  }, [authLoading, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return null;

  const totalCompleted = meetings.filter(m => m.status === 'completed').length;
  const totalWithMinutes = meetings.filter(m => !!m.minutes_structured).length;

  return (
    <div className="reuniones-page">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Reuniones</h1>
            <p className="page-subtitle">Graba, transcribe y genera minutas con Gemini AI</p>
          </div>
        </div>
        <button
          id="btn-nueva-reunion"
          className="btn-new-meeting"
          onClick={() => setShowModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Reunión
        </button>
      </div>

      {/* Stats cards */}
      {!loading && meetings.length > 0 && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-number">{meetings.length}</span>
            <span className="stat-label">Total de reuniones</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{totalCompleted}</span>
            <span className="stat-label">Completadas</span>
          </div>
          <div className="stat-card stat-card-ai">
            <span className="stat-number">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', marginRight: 4 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {totalWithMinutes}
            </span>
            <span className="stat-label">Con minuta IA</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-row">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`filter-btn ${filter === opt.value ? 'active' : ''}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="meetings-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h2 className="empty-title">
            {filter !== 'all' ? 'No hay reuniones con este filtro' : 'Sin reuniones registradas'}
          </h2>
          <p className="empty-desc">
            {filter !== 'all'
              ? 'Prueba con otro filtro o crea una nueva reunión.'
              : 'Crea tu primera reunión para comenzar a grabar y generar minutas automáticamente con Gemini AI.'}
          </p>
          {filter === 'all' && (
            <button className="btn-new-meeting" onClick={() => setShowModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Crear primera reunión
            </button>
          )}
        </div>
      ) : (
        <div className="meetings-grid">
          {meetings.map(meeting => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => router.push(`/dashboard/reuniones/${meeting.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <NewMeetingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />

      <style jsx>{`
        .reuniones-page {
          padding: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Page header */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .page-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .page-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 15px rgba(124,58,237,0.3);
        }
        .page-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0 0 0.15rem;
        }
        .page-subtitle {
          font-size: 0.82rem;
          color: #64748b;
          margin: 0;
        }
        .btn-new-meeting {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          border: none;
          border-radius: 0.875rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          box-shadow: 0 4px 15px rgba(124,58,237,0.3);
        }
        .btn-new-meeting:hover { background: linear-gradient(135deg, #8b5cf6, #7c3aed); transform: translateY(-1px); }
        .btn-new-meeting:active { transform: translateY(0); }

        /* Stats */
        .stats-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .stat-card {
          flex: 1;
          min-width: 120px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.875rem;
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .stat-card-ai {
          background: linear-gradient(135deg, #faf5ff, #f5f3ff);
          border-color: #e9d5ff;
        }
        .stat-number {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1e293b;
          display: flex;
          align-items: center;
        }
        .stat-card-ai .stat-number { color: #7c3aed; }
        .stat-label {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }

        /* Filters */
        .filters-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .filter-btn {
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          border: 1.5px solid #e2e8f0;
          background: white;
          color: #64748b;
          font-family: inherit;
          transition: all 0.15s;
        }
        .filter-btn:hover { border-color: #c4b5fd; color: #7c3aed; }
        .filter-btn.active {
          background: #7c3aed;
          border-color: #7c3aed;
          color: white;
        }

        /* Grid */
        .meetings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        /* Skeleton */
        .skeleton-card {
          height: 200px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          border-radius: 1rem;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        .empty-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #faf5ff, #f5f3ff);
          border: 2px solid #e9d5ff;
          border-radius: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7c3aed;
        }
        .empty-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .empty-desc {
          font-size: 0.875rem;
          color: #64748b;
          max-width: 400px;
          line-height: 1.6;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
