import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { store } from "@/lib/store";

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "officer" || user.club !== "Scotty Sound") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const order = store.orders.find((candidate) => candidate.tickets.some((ticket) => ticket.token === body.token));
  const ticket = order?.tickets.find((candidate) => candidate.token === body.token);
  if (!order || !ticket) return NextResponse.json({ error: "Invalid ticket." }, { status: 404 });
  const { events } = await import("@/lib/events");
  const event = events.find((candidate) => candidate.id === order.eventId);
  if (!event || event.club !== user.club) return NextResponse.json({ error: "Invalid ticket." }, { status: 404 });
  if (ticket.checkedInAt) return NextResponse.json({ error: "Already used.", checkedInAt: ticket.checkedInAt }, { status: 409 });
  ticket.checkedInAt = new Date().toISOString();
  return NextResponse.json({ checkedIn: true, name: order.name, checkedInAt: ticket.checkedInAt });
}
