import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getSession, sessionCookieName, type DemoUser } from "@/lib/session";

export async function GET() {
  return NextResponse.json({ user: await getSession() });
}

export async function POST(request: NextRequest) {
  if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "University sign-in is not configured for this deployment." }, { status: 503 });
  }

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.role !== "student" && body.role !== "officer") {
    return NextResponse.json({ error: "Choose a valid demo account." }, { status: 400 });
  }

  const user: DemoUser = body.role === "officer"
    ? { id: "demo-officer", name: "Alex Morgan", email: "alex.morgan@andrew.cmu.edu", role: "officer", club: "Scotty Sound", issuedAt: Date.now() }
    : { id: "demo-student", name: "Jordan Lee", email: "jordan.lee@andrew.cmu.edu", role: "student", club: null, issuedAt: Date.now() };

  let token: string;
  try {
    token = createSessionToken(user);
  } catch (error) {
    console.error("Unable to create session:", error);
    return NextResponse.json({ error: "Demo sign-in is not configured. Set SESSION_SECRET." }, { status: 503 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(sessionCookieName);
  return response;
}
