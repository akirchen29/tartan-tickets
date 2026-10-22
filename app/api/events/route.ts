import { NextResponse } from "next/server";
import { events, type EventItem } from "@/lib/events";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: events.filter((event) => event.status === "published") });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "officer" || !user.club) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  let body: Partial<EventItem>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    typeof body.title !== "string" || !body.title.trim() ||
    typeof body.location !== "string" || !body.location.trim() ||
    typeof body.date !== "string" || Number.isNaN(Date.parse(body.date)) ||
    typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 1 ||
    typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) ||
    (body.priceCents !== 0 && body.priceCents < 100)
  ) {
    return NextResponse.json({ error: "Enter a valid title, date, location, capacity, and price (free or at least $1)." }, { status: 400 });
  }
  const event: EventItem = {
    id: crypto.randomUUID(),
    title: body.title.trim().slice(0, 90),
    club: user.club,
    category: typeof body.category === "string" ? body.category.slice(0, 30).toUpperCase() : "COMMUNITY",
    date: body.date,
    time: typeof body.time === "string" ? body.time.slice(0, 20) : "6:00 PM",
    location: body.location.trim().slice(0, 100),
    priceCents: body.priceCents,
    capacity: body.capacity,
    sold: 0,
    description: typeof body.description === "string" ? body.description.slice(0, 500) : "",
    color: "green",
    status: "published",
  };
  events.unshift(event);
  return NextResponse.json({ event }, { status: 201 });
}
