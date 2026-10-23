import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getSession, sessionCookieName, type DemoUser } from "@/lib/session";

export async function GET() {
  return NextResponse.json({ user: await getSession() });
}

export async function POST(request: NextRequest) {
  if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "University sign-in is not configured for this deployment." }, { status: 503 });
  }

  let body: { name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80 || (body.role !== "student" && body.role !== "officer")) {
    return NextResponse.json({ error: "Enter your name and choose a preview role." }, { status: 400 });
  }

  const role = body.role;
  const id = `preview-${createHash("sha256").update(`${role}:${name.toLowerCase()}`).digest("hex").slice(0, 24)}`;
  const user: DemoUser = {
    id,
    name,
    email: "",
    role,
    club: role === "officer" ? "Scotty Sound" : null,
    issuedAt: Date.now(),
  };

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
