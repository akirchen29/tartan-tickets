import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
import { getSession } from "@/lib/session";
import { promoteWaitlist, store } from "@/lib/store";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  promoteWaitlist();
  const notifications = store.notifications
    .filter((notification) => notification.userId === user.id)
    .map(({ id, eventId, eventTitle, status, createdAt, holdExpiresAt }) => ({
      id, eventId, eventTitle, status, createdAt, holdExpiresAt,
    }));
  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  promoteWaitlist();
  const event = typeof body.eventId === "string" ? getEvent(body.eventId) : undefined;
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.capacity > event.sold) return NextResponse.json({ error: "Tickets are still available." }, { status: 409 });
  const queue = store.waitlist.get(event.id) ?? [];
  const alreadyQueued = queue.some((entry) => entry.userId === user.id);
  const hasActiveHold = store.notifications.some((notification) =>
    notification.eventId === event.id && notification.userId === user.id && notification.status === "active");
  if (alreadyQueued || hasActiveHold) return NextResponse.json({ error: "You are already on this waitlist." }, { status: 409 });
  queue.push({ id: crypto.randomUUID(), userId: user.id, name: user.name, createdAt: new Date().toISOString() });
  store.waitlist.set(event.id, queue);
  return NextResponse.json({ joined: true, position: queue.length }, { status: 201 });
}
