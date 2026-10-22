import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
import { getSession } from "@/lib/session";
import { store } from "@/lib/store";

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const event = typeof body.eventId === "string" ? getEvent(body.eventId) : undefined;
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.capacity > event.sold) return NextResponse.json({ error: "Tickets are still available." }, { status: 409 });
  const attendees = store.waitlist.get(event.id) ?? new Set<string>();
  if (attendees.has(user.id)) return NextResponse.json({ error: "You are already on this waitlist." }, { status: 409 });
  attendees.add(user.id);
  store.waitlist.set(event.id, attendees);
  return NextResponse.json({ joined: true, position: attendees.size }, { status: 201 });
}
