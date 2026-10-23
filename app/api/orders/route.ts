import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
import { getSession } from "@/lib/session";
import { isRateLimited, promoteWaitlist, store, type TicketOrder } from "@/lib/store";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  promoteWaitlist();
  return NextResponse.json({ orders: store.orders.filter((order) => order.userId === user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  promoteWaitlist();
  if (isRateLimited(user, "checkout", 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many checkout attempts. Try again later." }, { status: 429 });
  }

  let body: { eventId?: string; seats?: number; holdId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.holdId === "string") {
    const hold = store.notifications.find((notification) =>
      notification.id === body.holdId && notification.userId === user.id);
    if (!hold || hold.status !== "active") {
      return NextResponse.json({ error: "This seat hold has expired or is no longer available." }, { status: 410 });
    }
    const event = getEvent(hold.eventId);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const order: TicketOrder = {
      id: randomUUID(),
      eventId: event.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      seats: 1,
      createdAt: new Date().toISOString(),
      tickets: [{ token: randomBytes(16).toString("hex"), checkedInAt: null }],
    };
    hold.status = "claimed";
    store.orders.push(order);
    return NextResponse.json({ order, demo: true }, { status: 201 });
  }

  const event = typeof body.eventId === "string" ? getEvent(body.eventId) : undefined;
  const seats = body.seats;
  if (!event || !Number.isInteger(seats) || !seats || seats < 1 || seats > 4) {
    return NextResponse.json({ error: "Choose an event and between 1 and 4 tickets." }, { status: 400 });
  }
  if (event.capacity - event.sold < seats) {
    return NextResponse.json({ error: "Not enough tickets remain. Join the waitlist instead." }, { status: 409 });
  }

  event.sold += seats;
  const order: TicketOrder = {
    id: randomUUID(),
    eventId: event.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    seats,
    createdAt: new Date().toISOString(),
    tickets: Array.from({ length: seats }, () => ({ token: randomBytes(16).toString("hex"), checkedInAt: null })),
  };
  store.orders.push(order);
  return NextResponse.json({ order, demo: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.orderId !== "string") {
    return NextResponse.json({ error: "Choose a ticket to release." }, { status: 400 });
  }

  const orderIndex = store.orders.findIndex((order) => order.id === body.orderId && order.userId === user.id);
  if (orderIndex < 0) return NextResponse.json({ error: "Ticket order not found." }, { status: 404 });
  const [order] = store.orders.splice(orderIndex, 1);
  if (order.tickets.some((ticket) => ticket.checkedInAt)) {
    store.orders.splice(orderIndex, 0, order);
    return NextResponse.json({ error: "A checked-in ticket cannot be released." }, { status: 409 });
  }

  const event = getEvent(order.eventId);
  if (!event) {
    store.orders.splice(orderIndex, 0, order);
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  event.sold = Math.max(0, event.sold - order.seats);
  promoteWaitlist(event.id);
  return NextResponse.json({ released: order.seats });
}
