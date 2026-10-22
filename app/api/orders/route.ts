import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
import { getSession } from "@/lib/session";
import { isRateLimited, store } from "@/lib/store";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ orders: store.orders.filter((order) => order.userId === user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (isRateLimited(user, "checkout", 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many checkout attempts. Try again later." }, { status: 429 });
  }

  let body: { eventId?: string; seats?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
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
  const order = {
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
