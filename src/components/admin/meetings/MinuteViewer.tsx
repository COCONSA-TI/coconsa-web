'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import type { Meeting, MeetingMinutes, MeetingTask } from '@/types/database';

interface MinuteViewerProps {
  meeting: Meeting;
  minutes: MeetingMinutes;
  onUpdate?: (updated: Meeting) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  // Si ya está en DD/MM/YYYY, devolver tal cual
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
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

function formatDurationLong(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !h) parts.push(`${s}s`);
  return parts.join(' ') || '< 1m';
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportToPDF(meeting: Meeting, minutes: MeetingMinutes) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const addPageIfNeeded = (neededH: number) => {
    if (y + neededH > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Encabezado ──
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MINUTA DE REUNIÓN', margin, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('COCONSA — Gestión de Reuniones', margin, 20);
  y = 38;

  // ── Datos generales ──
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(meeting.title, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha: ${minutes.fecha || formatDate(meeting.started_at)}`, margin, y);
  doc.text(`Duración: ${formatDurationLong(meeting.duration_seconds)}`, margin + 70, y);
  y += 5;
  if (meeting.description) {
    doc.text(`Descripción: ${meeting.description}`, margin, y);
    y += 5;
  }
  y += 4;

  const drawSectionTitle = (title: string) => {
    addPageIfNeeded(14);
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(margin, y, contentW, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(109, 40, 217);
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
  };

  // ── Participantes ──
  if (minutes.participantes?.length) {
    drawSectionTitle('PARTICIPANTES');
    const names = minutes.participantes.join('  •  ');
    const lines = doc.splitTextToSize(names, contentW);
    addPageIfNeeded(lines.length * 5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  // ── Objetivo ──
  if (minutes.objetivo) {
    drawSectionTitle('OBJETIVO DE LA REUNIÓN');
    const lines = doc.splitTextToSize(minutes.objetivo, contentW);
    addPageIfNeeded(lines.length * 5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  // ── Puntos tratados ──
  if (minutes.puntos_tratados?.length) {
    drawSectionTitle('PUNTOS TRATADOS');
    minutes.puntos_tratados.forEach((p, idx) => {
      addPageIfNeeded(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${idx + 1}. ${p.titulo}`, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(p.detalle, contentW - 6);
      addPageIfNeeded(lines.length * 5 + 4);
      doc.setTextColor(71, 85, 105);
      doc.text(lines, margin + 4, y);
      doc.setTextColor(30, 41, 59);
      y += lines.length * 5 + 3;
    });
    y += 2;
  }

  // ── Acuerdos ──
  if (minutes.acuerdos?.length) {
    drawSectionTitle('ACUERDOS Y DECISIONES');
    minutes.acuerdos.forEach((a) => {
      const lines = doc.splitTextToSize(`• ${a}`, contentW - 4);
      addPageIfNeeded(lines.length * 5 + 3);
      doc.text(lines, margin + 2, y);
      y += lines.length * 5 + 2;
    });
    y += 2;
  }

  // ── Tareas ──
  if (minutes.tareas?.length) {
    drawSectionTitle('TAREAS Y RESPONSABLES');
    minutes.tareas.forEach((t: MeetingTask, idx) => {
      addPageIfNeeded(18);
      const bgColor = idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(margin, y - 3, contentW, 14, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(t.responsable || 'Sin asignar', margin + 2, y + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const taskLines = doc.splitTextToSize(t.tarea, contentW - 60);
      doc.text(taskLines, margin + 2, y + 6.5);
      doc.setTextColor(30, 41, 59);

      if (t.fecha_compromiso) {
        doc.setFontSize(8);
        doc.setTextColor(124, 58, 237);
        doc.text(`⏱ ${t.fecha_compromiso}`, margin + contentW - 40, y + 2);
        doc.setTextColor(30, 41, 59);
      }
      y += 16;
    });
    y += 2;
  }

  // ── Próxima reunión ──
  if (minutes.proxima_reunion) {
    drawSectionTitle('PRÓXIMA REUNIÓN');
    doc.text(minutes.proxima_reunion, margin, y);
    y += 8;
  }

  // ── Footer en cada página ──
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, ph - 12, pageW - margin, ph - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `COCONSA — Minuta generada con IA Gemini • ${new Date().toLocaleDateString('es-MX')}`,
      margin,
      ph - 7
    );
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 20, ph - 7);
  }

  const fileName = `Minuta_${meeting.title.replace(/\s+/g, '_').slice(0, 40)}_${minutes.fecha?.replace(/\//g, '-') ?? 'sin-fecha'}.pdf`;
  doc.save(fileName);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MinuteViewer({ meeting, minutes, onUpdate }: MinuteViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMinutes, setEditedMinutes] = useState<MeetingMinutes>(minutes);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/v1/meetings/${meeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ minutes_structured: editedMinutes }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveSuccess(true);
        onUpdate?.(data.meeting);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const displayMinutes = isEditing ? editedMinutes : minutes;

  return (
    <div className="minute-viewer">
      {/* Toolbar */}
      <div className="mv-toolbar">
        <h2 className="mv-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Minuta Generada
          <span className="mv-ai-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            IA
          </span>
        </h2>
        <div className="mv-actions">
          {saveSuccess && (
            <span className="mv-save-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Guardado
            </span>
          )}
          {isEditing ? (
            <>
              <button
                className="mv-btn mv-btn-secondary"
                onClick={() => { setEditedMinutes(minutes); setIsEditing(false); }}
              >
                Cancelar
              </button>
              <button
                className="mv-btn mv-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <>
              <button
                className="mv-btn mv-btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar
              </button>
              <button
                id="btn-export-pdf"
                className="mv-btn mv-btn-pdf"
                onClick={() => exportToPDF(meeting, minutes)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Encabezado de la minuta */}
      <div className="mv-header-card">
        <div className="mv-header-row">
          <div className="mv-header-item">
            <span className="mv-label">📅 Fecha</span>
            <span className="mv-value">
              {isEditing ? (
                <input
                  className="mv-input"
                  value={editedMinutes.fecha}
                  onChange={e => setEditedMinutes({ ...editedMinutes, fecha: e.target.value })}
                  placeholder="DD/MM/YYYY"
                />
              ) : displayMinutes.fecha || formatDate(meeting.started_at)}
            </span>
          </div>
          <div className="mv-header-item">
            <span className="mv-label">⏱ Duración</span>
            <span className="mv-value">{formatDurationLong(meeting.duration_seconds)}</span>
          </div>
        </div>

        {/* Participantes */}
        <div className="mv-section-inline">
          <span className="mv-label">👥 Participantes</span>
          <div className="mv-participants">
            {(displayMinutes.participantes ?? []).map((p, i) => (
              <span key={i} className="mv-participant-chip">{p}</span>
            ))}
            {(!displayMinutes.participantes || displayMinutes.participantes.length === 0) && (
              <span className="mv-empty">No se registraron participantes</span>
            )}
          </div>
        </div>
      </div>

      {/* Objetivo */}
      <div className="mv-section">
        <div className="mv-section-header">
          <span className="mv-section-icon">🎯</span>
          <h3 className="mv-section-title">Objetivo de la Reunión</h3>
        </div>
        {isEditing ? (
          <textarea
            className="mv-textarea"
            value={editedMinutes.objetivo}
            onChange={e => setEditedMinutes({ ...editedMinutes, objetivo: e.target.value })}
            rows={3}
          />
        ) : (
          <p className="mv-body-text">{displayMinutes.objetivo || <em className="mv-empty">No especificado</em>}</p>
        )}
      </div>

      {/* Puntos tratados */}
      {(displayMinutes.puntos_tratados?.length > 0) && (
        <div className="mv-section">
          <div className="mv-section-header">
            <span className="mv-section-icon">📋</span>
            <h3 className="mv-section-title">Puntos Tratados</h3>
          </div>
          <ol className="mv-points-list">
            {displayMinutes.puntos_tratados.map((p, i) => (
              <li key={i} className="mv-point-item">
                <div className="mv-point-number">{i + 1}</div>
                <div className="mv-point-content">
                  {isEditing ? (
                    <>
                      <input
                        className="mv-input mv-input-bold"
                        value={p.titulo}
                        onChange={e => {
                          const pts = [...editedMinutes.puntos_tratados];
                          pts[i] = { ...pts[i], titulo: e.target.value };
                          setEditedMinutes({ ...editedMinutes, puntos_tratados: pts });
                        }}
                        placeholder="Título del punto"
                      />
                      <textarea
                        className="mv-textarea mv-textarea-sm"
                        value={p.detalle}
                        onChange={e => {
                          const pts = [...editedMinutes.puntos_tratados];
                          pts[i] = { ...pts[i], detalle: e.target.value };
                          setEditedMinutes({ ...editedMinutes, puntos_tratados: pts });
                        }}
                        rows={2}
                      />
                    </>
                  ) : (
                    <>
                      <strong className="mv-point-title">{p.titulo}</strong>
                      <p className="mv-point-detail">{p.detalle}</p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Acuerdos */}
      {(displayMinutes.acuerdos?.length > 0) && (
        <div className="mv-section">
          <div className="mv-section-header">
            <span className="mv-section-icon">✅</span>
            <h3 className="mv-section-title">Acuerdos y Decisiones</h3>
          </div>
          <ul className="mv-agreements-list">
            {displayMinutes.acuerdos.map((a, i) => (
              <li key={i} className="mv-agreement-item">
                <div className="mv-check-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {isEditing ? (
                  <input
                    className="mv-input mv-input-flex"
                    value={a}
                    onChange={e => {
                      const arr = [...editedMinutes.acuerdos];
                      arr[i] = e.target.value;
                      setEditedMinutes({ ...editedMinutes, acuerdos: arr });
                    }}
                  />
                ) : (
                  <span>{a}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tareas */}
      {(displayMinutes.tareas?.length > 0) && (
        <div className="mv-section">
          <div className="mv-section-header">
            <span className="mv-section-icon">📌</span>
            <h3 className="mv-section-title">Tareas y Responsables</h3>
          </div>
          <div className="mv-tasks-grid">
            {displayMinutes.tareas.map((t, i) => (
              <div key={i} className="mv-task-card">
                <div className="mv-task-header">
                  <div className="mv-task-avatar">
                    {(t.responsable?.[0] ?? '?').toUpperCase()}
                  </div>
                  {isEditing ? (
                    <input
                      className="mv-input mv-input-bold"
                      value={t.responsable}
                      onChange={e => {
                        const arr = [...editedMinutes.tareas];
                        arr[i] = { ...arr[i], responsable: e.target.value };
                        setEditedMinutes({ ...editedMinutes, tareas: arr });
                      }}
                      placeholder="Responsable"
                    />
                  ) : (
                    <strong className="mv-task-owner">{t.responsable || 'Sin asignar'}</strong>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    className="mv-textarea mv-textarea-sm"
                    value={t.tarea}
                    onChange={e => {
                      const arr = [...editedMinutes.tareas];
                      arr[i] = { ...arr[i], tarea: e.target.value };
                      setEditedMinutes({ ...editedMinutes, tareas: arr });
                    }}
                    rows={2}
                  />
                ) : (
                  <p className="mv-task-desc">{t.tarea}</p>
                )}
                {(t.fecha_compromiso || isEditing) && (
                  <div className="mv-task-date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {isEditing ? (
                      <input
                        className="mv-input"
                        value={t.fecha_compromiso ?? ''}
                        onChange={e => {
                          const arr = [...editedMinutes.tareas];
                          arr[i] = { ...arr[i], fecha_compromiso: e.target.value || null };
                          setEditedMinutes({ ...editedMinutes, tareas: arr });
                        }}
                        placeholder="DD/MM/YYYY"
                      />
                    ) : (
                      <span>{t.fecha_compromiso ?? 'Sin fecha'}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próxima reunión */}
      {(displayMinutes.proxima_reunion || isEditing) && (
        <div className="mv-section mv-section-next">
          <div className="mv-section-header">
            <span className="mv-section-icon">🔜</span>
            <h3 className="mv-section-title">Próxima Reunión</h3>
          </div>
          {isEditing ? (
            <input
              className="mv-input"
              value={editedMinutes.proxima_reunion ?? ''}
              onChange={e => setEditedMinutes({ ...editedMinutes, proxima_reunion: e.target.value || null })}
              placeholder="Fecha y hora de la próxima reunión..."
            />
          ) : (
            <p className="mv-body-text mv-next-date">{displayMinutes.proxima_reunion}</p>
          )}
        </div>
      )}

      <style jsx>{`
        .minute-viewer {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Toolbar */
        .mv-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .mv-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .mv-ai-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem 0.5rem;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .mv-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .mv-save-success {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #16a34a;
        }
        .mv-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 0.625rem;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .mv-btn:active { transform: scale(0.97); }
        .mv-btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .mv-btn-secondary:hover { background: #e2e8f0; }
        .mv-btn-primary {
          background: #1e293b;
          color: white;
        }
        .mv-btn-primary:hover:not(:disabled) { background: #0f172a; }
        .mv-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .mv-btn-pdf {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: white;
          box-shadow: 0 3px 10px rgba(220,38,38,0.25);
        }
        .mv-btn-pdf:hover { background: linear-gradient(135deg, #ef4444, #dc2626); }

        /* Header card */
        .mv-header-card {
          background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
          border: 1px solid #e9d5ff;
          border-radius: 1rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }
        .mv-header-row {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .mv-header-item {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .mv-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: #7c3aed;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .mv-value {
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
        }
        .mv-section-inline {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .mv-participants {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .mv-participant-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          background: white;
          border: 1px solid #ddd6fe;
          border-radius: 9999px;
          font-size: 0.8rem;
          color: #5b21b6;
          font-weight: 500;
        }
        .mv-empty {
          font-size: 0.8rem;
          color: #94a3b8;
          font-style: italic;
        }

        /* Sections */
        .mv-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.875rem;
          padding: 1.25rem;
        }
        .mv-section-next {
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          border-color: #bfdbfe;
        }
        .mv-section-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.875rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .mv-section-icon { font-size: 1rem; }
        .mv-section-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .mv-body-text {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #334155;
          margin: 0;
        }
        .mv-next-date {
          font-weight: 600;
          color: #1d4ed8;
        }

        /* Points list */
        .mv-points-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .mv-point-item {
          display: flex;
          gap: 0.875rem;
          align-items: flex-start;
        }
        .mv-point-number {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 700;
          margin-top: 1px;
        }
        .mv-point-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .mv-point-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #1e293b;
        }
        .mv-point-detail {
          font-size: 0.825rem;
          line-height: 1.6;
          color: #64748b;
          margin: 0;
        }

        /* Agreements */
        .mv-agreements-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .mv-agreement-item {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.875rem;
          color: #334155;
          line-height: 1.6;
        }
        .mv-check-icon {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          background: #dcfce7;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #16a34a;
          margin-top: 2px;
        }

        /* Tasks */
        .mv-tasks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.875rem;
        }
        .mv-task-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .mv-task-header {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .mv-task-avatar {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .mv-task-owner {
          font-size: 0.85rem;
          color: #1e293b;
          font-weight: 700;
        }
        .mv-task-desc {
          font-size: 0.8rem;
          line-height: 1.55;
          color: #475569;
          margin: 0;
        }
        .mv-task-date {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #7c3aed;
          font-weight: 600;
          padding-top: 0.375rem;
          border-top: 1px solid #e2e8f0;
        }

        /* Edit inputs */
        .mv-input {
          padding: 0.4rem 0.625rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.85rem;
          color: #1e293b;
          font-family: inherit;
          background: white;
          width: 100%;
          box-sizing: border-box;
          outline: none;
        }
        .mv-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }
        .mv-input-bold { font-weight: 600; }
        .mv-input-flex { flex: 1; }
        .mv-textarea {
          padding: 0.5rem 0.625rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.85rem;
          color: #1e293b;
          font-family: inherit;
          background: white;
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          line-height: 1.6;
          outline: none;
        }
        .mv-textarea:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }
        .mv-textarea-sm { font-size: 0.8rem; }
      `}</style>
    </div>
  );
}
