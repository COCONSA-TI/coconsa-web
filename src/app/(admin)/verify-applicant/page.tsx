'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyApplicantContent() {
  const searchParams = useSearchParams();
  const dataParam = searchParams.get('data');
  
  let applicantInfo = null;
  
  try {
    if (dataParam) {
      applicantInfo = JSON.parse(decodeURIComponent(dataParam));
    }
  } catch (error) {
    console.error('Error parsing applicant data:', error);
  }

  if (!applicantInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Información no disponible
          </h1>
          <p className="text-gray-600">
            No se pudo verificar la información del solicitante.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg 
              className="w-8 h-8 text-green-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Verificación de Solicitante
          </h1>
          <p className="text-sm text-gray-500">
            Información del solicitante de la orden de compra
          </p>
        </div>

        <div className="space-y-4">
          <div className="border-b pb-3">
            <p className="text-sm text-gray-500 font-medium mb-1">Nombre Completo</p>
            <p className="text-lg font-semibold text-gray-800">{applicantInfo.nombre}</p>
          </div>

          <div className="border-b pb-3">
            <p className="text-sm text-gray-500 font-medium mb-1">Correo Electrónico</p>
            <p className="text-gray-700">{applicantInfo.email}</p>
          </div>

          <div className="border-b pb-3">
            <p className="text-sm text-gray-500 font-medium mb-1">ID de Orden</p>
            <p className="text-gray-700 font-mono">{applicantInfo.orderId}</p>
          </div>

          <div className="pb-3">
            <p className="text-sm text-gray-500 font-medium mb-1">Fecha de Solicitud</p>
            <p className="text-gray-700">{applicantInfo.fecha}</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <svg 
              className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
                clipRule="evenodd" 
              />
            </svg>
            <p className="text-sm text-blue-800">
              Este código QR verifica la autenticidad del solicitante de esta orden de compra.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            COCONSA CONSTRUCCIONES S.A DE C.V.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyApplicantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyApplicantContent />
    </Suspense>
  );
}
