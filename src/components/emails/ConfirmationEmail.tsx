// src/components/emails/ConfirmationEmail.tsx
import * as React from 'react';

interface EmailProps {
  name: string;
  items: { id: string; quantity: number }[];
}

const ConfirmationEmail: React.FC<Readonly<EmailProps>> = ({ name, items }) => (
  <div>
    <h1>¡Hemos recibido tu solicitud de cotización, {name}!</h1>
    <p>
      Gracias por tu interés en la maquinaria de COCONSA. Nuestro equipo ya está revisando tu solicitud y te contactará a la brevedad con una cotización detallada.
    </p>
    
    <h2>Resumen de tu Solicitud:</h2>
    <p>Has solicitado cotización para la siguiente maquinaria:</p>
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.id}</strong> (Cantidad: {item.quantity})
        </li>
      ))}
    </ul>
    <br />
    <p>Si tienes alguna pregunta adicional, no dudes en contactarnos.</p>
    <p>Atentamente,<br />El equipo de COCONSA</p>
  </div>
);

export default ConfirmationEmail;