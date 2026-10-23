import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { events, initialEvents } from "@/lib/events";
import type { DemoUser } from "@/lib/session";
import { store } from "@/lib/store";

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/session", () => sessionMock);

import { POST as createOrder } from "@/app/api/orders/route";
import { getSession } from "@/lib/session";

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

function checkout(eventId: string) {
  return createOrder(new NextRequest("http://localhost/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, seats: 1 }),
  }));
}

describe("SEC-16 checkout rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    events.splice(0, events.length, ...structuredClone(initialEvents));
    store.orders.length = 0;
    store.requestTimes.clear();
    store.checkoutLimits.clear();
    store.checkoutBlockedUntil.clear();
    vi.mocked(getSession).mockReset();
  });

  test("An account is blocked for 30 minutes after its sixth checkout for one event.", async () => {
    const user = makeUser("checkout-student");
    vi.mocked(getSession).mockResolvedValue(user);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await checkout("late-night-lab")).status).toBe(201);
    }

    expect((await checkout("late-night-lab")).status).toBe(429);

    vi.setSystemTime(new Date(now.getTime() + 10 * 60 * 1000 + 1));
    expect((await checkout("late-night-lab")).status).toBe(429);
    expect((await checkout("makers-market")).status).toBe(429);

    vi.mocked(getSession).mockResolvedValue(makeUser("another-student"));
    expect((await checkout("late-night-lab")).status).toBe(201);

    vi.mocked(getSession).mockResolvedValue(user);
    vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000));
    expect((await checkout("late-night-lab")).status).toBe(201);
  });
});
