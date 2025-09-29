import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ 
        message: 'Test API is working!', 
        timestamp: new Date().toISOString() 
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        return NextResponse.json({ 
            message: 'POST request received successfully For api V1', 
            receivedData: body,
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to parse request body' },
            { status: 400 }
        );
    }
}