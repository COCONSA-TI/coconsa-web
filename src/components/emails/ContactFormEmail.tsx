// src/components/emails/ContactFormEmail.tsx
import * as React from 'react';

interface EmailProps {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

const ContactFormEmail: React.FC<Readonly<EmailProps>> = ({ name, email, phone, message }) => (
  <div>
    <h1>Nuevo Mensaje desde la Web de COCONSA</h1>
    <p>Has recibido un nuevo mensaje a través del formulario de contacto.</p>
    
    <h2>Detalles del Remitente:</h2>
    <ul>
      <li><strong>Nombre:</strong> {name}</li>
      <li><strong>Email:</strong> {email}</li>
      {phone && <li><strong>Teléfono:</strong> {phone}</li>}
    </ul>

    <h2>Mensaje:</h2>
    <p>{message}</p>
  </div>
);

export default ContactFormEmail;