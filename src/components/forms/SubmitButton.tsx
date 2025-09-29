// src/components/forms/SubmitButton.tsx
'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button 
      type="submit" 
      disabled={pending} // El botón se deshabilita mientras se envía
      className="mt-8 w-full bg-red-600 text-white font-bold py-3 px-8 rounded-lg transition-colors hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {pending ? 'Enviando Solicitud...' : 'Enviar Solicitud'}
    </button>
  );
}