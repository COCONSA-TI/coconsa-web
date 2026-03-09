import { NextResponse } from 'next/server';

// Este endpoint solo está disponible en entornos de desarrollo.
// En producción responde 404 para no exponer información del servidor.
function notInProduction() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = notInProduction();
  if (blocked) return blocked;

  return NextResponse.json({ 
      message: 'Test API is working!', 
      timestamp: new Date().toISOString() 
  });
}

export async function POST(request: Request) {
  const blocked = notInProduction();
  if (blocked) return blocked;

  try {
      const body = await request.json();
      
      return NextResponse.json({ 
          message: 'POST request received successfully For api V1', 
          receivedData: body,
          timestamp: new Date().toISOString() 
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
      return NextResponse.json(
          { error: 'Failed to parse request body' },
          { status: 400 }
      );
  }
}