'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewMeetingModal({ isOpen, onClose }: NewMeetingModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Enfocar el input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 150);
    } else {
      // Limpiar al cerrar
      setTitle('');
      setDescription('');
      setAttendeeInput('');
      setAttendees([]);
      setError(null);
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const addAttendee = () => {
    const value = attendeeInput.trim();
    if (value && !attendees.includes(value)) {
      setAttendees(prev => [...prev, value]);
      setAttendeeInput('');
    }
  };

  const removeAttendee = (index: number) => {
    setAttendees(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttendeeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAttendee();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          attendees,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al crear la reunión');
      }

      // Navegar a la página de la nueva reunión
      router.push(`/dashboard/reuniones/${data.meeting.id}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div>
            <h2 id="modal-title" className="modal-title">Nueva Reunión</h2>
            <p className="modal-subtitle">Crea la reunión y comienza a grabar con IA</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form className="modal-form" onSubmit={handleCreate}>
          {/* Título */}
          <div className="form-group">
            <label className="form-label" htmlFor="meeting-title">
              Título de la reunión <span className="required">*</span>
            </label>
            <input
              ref={titleRef}
              id="meeting-title"
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Revisión de presupuesto Q3, Junta de obra mensual..."
              maxLength={200}
              required
            />
            <span className="char-counter">{title.length}/200</span>
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label className="form-label" htmlFor="meeting-description">
              Descripción <span className="optional">(opcional)</span>
            </label>
            <textarea
              id="meeting-description"
              className="form-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Contexto o agenda de la reunión..."
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Participantes */}
          <div className="form-group">
            <label className="form-label" htmlFor="meeting-attendees">
              Participantes <span className="optional">(opcional)</span>
            </label>
            <div className="attendees-field">
              {attendees.map((a, i) => (
                <span key={i} className="attendee-chip">
                  {a}
                  <button
                    type="button"
                    onClick={() => removeAttendee(i)}
                    className="attendee-remove"
                    aria-label={`Eliminar ${a}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="meeting-attendees"
                type="text"
                className="attendee-input"
                value={attendeeInput}
                onChange={e => setAttendeeInput(e.target.value)}
                onKeyDown={handleAttendeeKeyDown}
                onBlur={addAttendee}
                placeholder={attendees.length === 0 ? 'Escribe un nombre y presiona Enter...' : '+ Agregar'}
              />
            </div>
            <p className="form-hint">Presiona Enter o coma para agregar participantes</p>
          </div>

          {/* Error */}
          {error && (
            <div className="form-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              id="btn-create-meeting"
              type="submit"
              className="btn-create"
              disabled={!title.trim() || loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  Creando...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Crear y Empezar
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          z-index: 100;
          animation: fadeIn 0.2s ease;
        }
        .modal-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 101;
          background: white;
          border-radius: 1.25rem;
          box-shadow: 0 25px 50px rgba(0,0,0,0.2);
          width: 90%;
          max-width: 520px;
          animation: slideUp 0.25s ease;
          overflow: hidden;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }

        /* Header */
        .modal-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem 1.5rem 1.25rem;
          background: linear-gradient(135deg, #faf5ff, #f5f3ff);
          border-bottom: 1px solid #e9d5ff;
        }
        .modal-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border-radius: 0.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.2rem 0;
        }
        .modal-subtitle {
          font-size: 0.8rem;
          color: #7c3aed;
          margin: 0;
        }
        .modal-close {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 0.25rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }
        .modal-close:hover { color: #1e293b; background: #f1f5f9; }

        /* Form */
        .modal-form {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          position: relative;
        }
        .form-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #374151;
        }
        .required { color: #dc2626; }
        .optional {
          font-weight: 400;
          color: #9ca3af;
          font-size: 0.75rem;
        }
        .form-input, .form-textarea {
          padding: 0.625rem 0.875rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 0.625rem;
          font-size: 0.875rem;
          color: #1e293b;
          background: #fafafa;
          font-family: inherit;
          transition: all 0.15s;
          outline: none;
        }
        .form-input:focus, .form-textarea:focus {
          border-color: #7c3aed;
          background: white;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        .form-textarea { resize: vertical; line-height: 1.6; }
        .char-counter {
          position: absolute;
          right: 0;
          top: 0;
          font-size: 0.7rem;
          color: #94a3b8;
        }
        .form-hint {
          font-size: 0.72rem;
          color: #9ca3af;
          margin: 0;
        }

        /* Attendees */
        .attendees-field {
          min-height: 42px;
          padding: 0.375rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 0.625rem;
          background: #fafafa;
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          align-items: center;
          transition: border-color 0.15s;
        }
        .attendees-field:focus-within {
          border-color: #7c3aed;
          background: white;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        .attendee-chip {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem 0.5rem;
          background: #ede9fe;
          color: #5b21b6;
          border-radius: 9999px;
          font-size: 0.78rem;
          font-weight: 500;
        }
        .attendee-remove {
          background: none;
          border: none;
          cursor: pointer;
          color: #7c3aed;
          font-size: 1rem;
          line-height: 1;
          padding: 0;
          display: flex;
          align-items: center;
          opacity: 0.7;
        }
        .attendee-remove:hover { opacity: 1; }
        .attendee-input {
          flex: 1;
          min-width: 120px;
          border: none;
          background: transparent;
          font-size: 0.85rem;
          color: #1e293b;
          font-family: inherit;
          outline: none;
          padding: 0.15rem 0.375rem;
        }
        .attendee-input::placeholder { color: #94a3b8; }

        /* Error */
        .form-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.625rem;
          font-size: 0.825rem;
          color: #dc2626;
        }

        /* Actions */
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          padding-top: 0.25rem;
        }
        .btn-cancel, .btn-create {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.7rem 1.25rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          border: none;
        }
        .btn-cancel {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .btn-cancel:hover:not(:disabled) { background: #e2e8f0; }
        .btn-create {
          flex: 1;
          justify-content: center;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          box-shadow: 0 4px 15px rgba(124,58,237,0.3);
        }
        .btn-create:hover:not(:disabled) { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .btn-create:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
