import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email, role,  } = body;

    return NextResponse.json({ message: "User registered successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse request body" },
      { status: 400 }
    );
  }
}