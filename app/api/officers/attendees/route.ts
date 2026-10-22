import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { store } from "@/lib/store";
import { events } from "@/lib/events";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "officer" || !user.club) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const eventId = request.nextUrl.searchParams.get("eventId");
  const event = events.find((item) => item.id === eventId && item.club === user.club);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const attendees = store.orders
    .filter((order) => order.eventId === event.id)
    .map(({ name, email, tickets, seats, createdAt }) => ({
      name, email, seats, createdAt,
      checkedInAt: tickets.some((ticket) => ticket.checkedInAt) ? tickets.find((ticket) => ticket.checkedInAt)?.checkedInAt ?? null : null,
    }));
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const rows = [["Name", "Email", "Check-in status"], ...attendees.map((person) => [
      person.name, person.email, person.checkedInAt ? "Checked in" : "Not checked in",
    ])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.id}-attendees.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ event: { id: event.id, title: event.title }, attendees });
}
