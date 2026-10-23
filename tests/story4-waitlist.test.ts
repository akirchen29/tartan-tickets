import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { events, initialEvents } from "@/lib/events";
import type { DemoUser } from "@/lib/session";
import { store } from "@/lib/store";

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/session", () => sessionMock);

import { DELETE as deleteOrder, POST as createOrder } from "@/app/api/orders/route";
import { GET as getWaitlist, POST as joinWaitlist } from "@/app/api/waitlist/route";
import { getSession } from "@/lib/session";

const eventId = "fall-fest";
const now = new Date("2026-10-22T16:00:00.000Z");

function makeUser(id: string): DemoUser {
  return {
    id,
    name: id,
    email: `${id}@example.test`,
    role: "student",
    club: null,
    issuedAt: now.getTime(),
  };
}

function request(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function responseBody<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function addToWaitlist(user: DemoUser) {
  vi.mocked(getSession).mockResolvedValue(user);
  return joinWaitlist(request("http://localhost/api/waitlist", "POST", { eventId }));
}

async function releaseSeat() {
  const event = events.find((item) => item.id === eventId)!;
  store.orders.push({
    id: "released-order",
    eventId,
    userId: "releasing-student",
    name: "Releasing Student",
    email: "releasing-student@example.test",
    seats: 1,
    createdAt: now.toISOString(),
    tickets: [{ token: "released-ticket", checkedInAt: null }],
  });
  vi.mocked(getSession).mockResolvedValue(makeUser("releasing-student"));
  return deleteOrder(request("http://localhost/api/orders", "DELETE", { orderId: "released-order" }));
}

describe("Story 4 waitlist", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    events.splice(0, events.length, ...structuredClone(initialEvents));
    store.orders.length = 0;
    store.notifications.length = 0;
    store.waitlist.clear();
    store.requestTimes.clear();
    store.checkoutLimits.clear();
    store.checkoutBlockedUntil.clear();
    vi.mocked(getSession).mockReset();
  });

  test("story4_released_seat_offers_fifo_hold", async () => {
    const first = makeUser("first-in-line");
    const second = makeUser("second-in-line");
    expect((await addToWaitlist(first)).status).toBe(201);
    expect((await addToWaitlist(second)).status).toBe(201);

    expect((await releaseSeat()).status).toBe(200);

    vi.mocked(getSession).mockResolvedValue(first);
    const firstResponse = await getWaitlist();
    const firstBody = await responseBody<{
      notifications: { id: string; status: string; holdExpiresAt: string }[];
    }>(firstResponse);
    expect(firstBody.notifications).toHaveLength(1);
    expect(firstBody.notifications[0].status).toBe("active");
    expect(Date.parse(firstBody.notifications[0].holdExpiresAt) - Date.now()).toBe(30 * 60 * 1000);

    vi.mocked(getSession).mockResolvedValue(second);
    const secondBody = await responseBody<{ notifications: unknown[] }>(await getWaitlist());
    expect(secondBody.notifications).toHaveLength(0);
    expect(store.waitlist.get(eventId)).toEqual([
      expect.objectContaining({ userId: second.id }),
    ]);
  });

  test("story4_expired_hold_offers_next_fifo_person", async () => {
    const first = makeUser("first-holder");
    const second = makeUser("next-holder");
    await addToWaitlist(first);
    await addToWaitlist(second);
    await releaseSeat();

    vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000));
    vi.mocked(getSession).mockResolvedValue(first);
    const firstBody = await responseBody<{
      notifications: { status: string }[];
    }>(await getWaitlist());
    expect(firstBody.notifications[0].status).toBe("expired");

    vi.mocked(getSession).mockResolvedValue(second);
    const secondBody = await responseBody<{
      notifications: { status: string; holdExpiresAt: string }[];
    }>(await getWaitlist());
    expect(secondBody.notifications).toHaveLength(1);
    expect(secondBody.notifications[0].status).toBe("active");
    expect(Date.parse(secondBody.notifications[0].holdExpiresAt) - Date.now()).toBe(30 * 60 * 1000);
    expect(store.waitlist.get(eventId)).toHaveLength(0);
  });

  test("story4_claimed_hold_creates_one_seat_order", async () => {
    const holder = makeUser("seat-holder");
    await addToWaitlist(holder);
    await releaseSeat();
    const hold = store.notifications.find((item) => item.userId === holder.id)!;
    const soldBeforeClaim = events.find((item) => item.id === eventId)!.sold;

    vi.mocked(getSession).mockResolvedValue(makeUser("different-student"));
    const unauthorizedResponse = await createOrder(request("http://localhost/api/orders", "POST", { holdId: hold.id }));
    expect(unauthorizedResponse.status).toBe(410);
    expect(hold.status).toBe("active");
    expect(store.orders).toHaveLength(0);

    vi.mocked(getSession).mockResolvedValue(holder);
    const response = await createOrder(request("http://localhost/api/orders", "POST", { holdId: hold.id }));
    const body = await responseBody<{
      order: { eventId: string; seats: number; tickets: unknown[] };
      demo: boolean;
    }>(response);

    expect(response.status).toBe(201);
    expect(body.order.eventId).toBe(eventId);
    expect(body.order.seats).toBe(1);
    expect(body.order.tickets).toHaveLength(1);
    expect(body.demo).toBe(true);
    expect(hold.status).toBe("claimed");
    expect(events.find((item) => item.id === eventId)!.sold).toBe(soldBeforeClaim);
  });

  test("story4_expired_hold_cannot_be_claimed", async () => {
    const holder = makeUser("expired-holder");
    await addToWaitlist(holder);
    await releaseSeat();
    const hold = store.notifications.find((item) => item.userId === holder.id)!;

    vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000));
    vi.mocked(getSession).mockResolvedValue(holder);
    const response = await createOrder(request("http://localhost/api/orders", "POST", { holdId: hold.id }));

    expect(response.status).toBe(410);
    expect(hold.status).toBe("expired");
    expect(store.orders).toHaveLength(0);
  });
});
