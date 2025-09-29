// src/components/emails/QuotationEmail.tsx
import * as React from 'react';

interface EmailProps {
    name: string;
    company: string;
    email: string;
    phone: string;
    items: { id: string; quantity: number }[];
    dateRange: { from: string; to: string };
}

const QuotationEmail: React.FC<Readonly<EmailProps>> = ({
    name,
    company,
    email,
    phone,
    items,
    dateRange,
}) => (
    <div>
        <h1>Nueva Solicitud de Cotización</h1>
        <p>Has recibido una nueva solicitud de cotización a través del sitio web.</p>

        <h2>Datos del Cliente:</h2>
        <ul>
            <li><strong>Nombre:</strong> {name}</li>
            {company && <li><strong>Empresa:</strong> {company}</li>}
            <li><strong>Email:</strong> {email}</li>
            <li><strong>Teléfono:</strong> {phone}</li>
        </ul>

        <h2>Fechas Solicitadas:</h2>
        <p>
            Desde: {new Date(dateRange.from).toLocaleDateString('es-MX')}
            <br />
            Hasta: {new Date(dateRange.to).toLocaleDateString('es-MX')}
        </p>

        <h2>Maquinaria Requerida:</h2>
        <table border={1} cellPadding={10} cellSpacing={0}>
            <thead>
                <tr>
                    <th>Máquina</th>
                    <th>Cantidad</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item) => (
                    <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.quantity}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default QuotationEmail;