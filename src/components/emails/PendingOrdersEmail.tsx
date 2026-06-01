import * as React from 'react';

interface PendingOrdersEmailProps {
  userName: string;
  pendingOrders: number;
  pendingNeedsLists: number;
  departmentName: string;
  appUrl: string;
  logoUrl: string;
}

const PendingOrdersEmail: React.FC<Readonly<PendingOrdersEmailProps>> = ({
  userName,
  pendingOrders,
  pendingNeedsLists,
  departmentName,
  appUrl,
  logoUrl,
}) => {
  const totalPending = pendingOrders + pendingNeedsLists;
  const currentDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      maxWidth: '520px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
    }}>
      {/* Header con logo */}
      <div style={{
        backgroundColor: '#1e293b',
        padding: '24px 32px',
        textAlign: 'center' as const,
        borderRadius: '8px 8px 0 0',
      }}>
        <img
          src={logoUrl}
          alt="COCONSA"
          width="160"
          height="auto"
          style={{ display: 'inline-block' }}
        />
      </div>

      {/* Contenido */}
      <div style={{
        padding: '32px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderTop: 'none',
      }}>
        <p style={{
          fontSize: '16px',
          color: '#334155',
          margin: '0 0 8px 0',
        }}>
          Buenos días,
        </p>
        <p style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 24px 0',
        }}>
          {userName}
        </p>

        <p style={{
          fontSize: '15px',
          color: '#475569',
          margin: '0 0 20px 0',
          lineHeight: '1.5',
        }}>
          Tienes <strong style={{ color: '#0f172a' }}>{totalPending} documento{totalPending !== 1 ? 's' : ''}</strong> pendiente{totalPending !== 1 ? 's' : ''} de
          revisión en <strong style={{ color: '#0f172a' }}>{departmentName}</strong>.
        </p>

        {/* Tarjetas de conteo */}
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
          <tbody>
            {pendingOrders > 0 && (
              <tr>
                <td style={{ padding: '0 0 10px 0' }}>
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tbody>
                        <tr>
                          <td style={{ width: '40px', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: '24px' }}>📋</span>
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: '14px',
                              color: '#0369a1',
                              fontWeight: 600,
                            }}>
                              Órdenes de Compra
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' as const, verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: '28px',
                              fontWeight: 700,
                              color: '#0c4a6e',
                            }}>
                              {pendingOrders}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            )}
            {pendingNeedsLists > 0 && (
              <tr>
                <td style={{ padding: '0 0 10px 0' }}>
                  <div style={{
                    backgroundColor: '#fefce8',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '16px 20px',
                  }}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tbody>
                        <tr>
                          <td style={{ width: '40px', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: '24px' }}>📝</span>
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: '14px',
                              color: '#a16207',
                              fontWeight: 600,
                            }}>
                              Listas de Necesidades
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' as const, verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: '28px',
                              fontWeight: 700,
                              color: '#713f12',
                            }}>
                              {pendingNeedsLists}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p style={{
          fontSize: '14px',
          color: '#64748b',
          margin: '0 0 24px 0',
          lineHeight: '1.5',
        }}>
          Por favor, ingresa al sistema para revisarlos a la brevedad.
        </p>

        {/* Botón al sistema */}
        <div style={{ textAlign: 'center' as const, marginBottom: '8px' }}>
          <a
            href={`${appUrl}/dashboard/ordenes`}
            style={{
              display: 'inline-block',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              padding: '12px 32px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Ir al Sistema
          </a>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '20px 32px',
        backgroundColor: '#f8fafc',
        borderRadius: '0 0 8px 8px',
        border: '1px solid #e2e8f0',
        borderTop: 'none',
        textAlign: 'center' as const,
      }}>
        <p style={{
          fontSize: '12px',
          color: '#94a3b8',
          margin: '0 0 4px 0',
        }}>
          Este es un correo automático del sistema COCONSA.
        </p>
        <p style={{
          fontSize: '12px',
          color: '#94a3b8',
          margin: '0',
        }}>
          {currentDate}
        </p>
      </div>
    </div>
  );
};

export default PendingOrdersEmail;
