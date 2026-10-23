import { randomUUID } from "node:crypto";
import type { DemoUser } from "@/lib/session";
import { events } from "@/lib/events";

export type TicketOrder = {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  email: string;
  seats: number;
  createdAt: string;
  tickets: { token: string; checkedInAt: string | null }[];
};

export type WaitlistEntry = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

export type WaitlistNotification = {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  status: "active" | "claimed" | "expired";
  createdAt: string;
  holdExpiresAt: string;
};

type CheckoutRateLimit = {
  attempts: number[];
};

type TartanStore = {
  orders: TicketOrder[];
  waitlist: Map<string, WaitlistEntry[]>;
  notifications: WaitlistNotification[];
  requestTimes: Map<string, number[]>;
  checkoutLimits: Map<string, CheckoutRateLimit>;
  checkoutBlockedUntil: Map<string, number>;
};

type PreviousTartanStore = {
  orders: TicketOrder[];
  waitlist: Map<string, WaitlistEntry[] | Set<string>>;
  notifications?: WaitlistNotification[];
  requestTimes: Map<string, number[]>;
  checkoutLimits?: Map<string, CheckoutRateLimit>;
  checkoutBlockedUntil?: Map<string, number>;
};

const globalForStore = globalThis as typeof globalThis & { tartanStore?: PreviousTartanStore };
const previousStore = globalForStore.tartanStore;
export const store: TartanStore = {
  orders: previousStore?.orders ?? [],
  waitlist: new Map(),
  notifications: previousStore?.notifications ?? [],
  requestTimes: previousStore?.requestTimes ?? new Map(),
  checkoutLimits: previousStore?.checkoutLimits ?? new Map(),
  checkoutBlockedUntil: previousStore?.checkoutBlockedUntil ?? new Map(),
};
for (const [eventId, entries] of previousStore?.waitlist ?? []) {
  const queue = Array.isArray(entries) ? entries : Array.from(entries, (userId) => ({
    id: randomUUID(),
    userId,
    name: userId,
    createdAt: new Date().toISOString(),
  }));
  store.waitlist.set(eventId, queue);
}
globalForStore.tartanStore = store;

export function promoteWaitlist(eventId?: string) {
  const now = Date.now();
  const availableEvents = events.filter((event) => !eventId || event.id === eventId);

  for (const event of availableEvents) {
    for (const notification of store.notifications) {
      if (notification.eventId === event.id && notification.status === "active" && Date.parse(notification.holdExpiresAt) <= now) {
        notification.status = "expired";
        event.sold = Math.max(0, event.sold - 1);
      }
    }

    const queue = store.waitlist.get(event.id) ?? [];
    while (event.status === "published" && event.sold < event.capacity && queue.length > 0) {
      const entry = queue.shift()!;
      event.sold += 1;
      const createdAt = new Date(now).toISOString();
      store.notifications.push({
        id: entry.id,
        eventId: event.id,
        eventTitle: event.title,
        userId: entry.userId,
        status: "active",
        createdAt,
        holdExpiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
      });
    }
    store.waitlist.set(event.id, queue);
  }
}

export function isRateLimited(user: DemoUser, action: string, limit: number, windowMs: number) {
  const key = `${user.id}:${action}`;
  const now = Date.now();
  const recent = (store.requestTimes.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    store.requestTimes.set(key, recent);
    return true;
  }
  recent.push(now);
  store.requestTimes.set(key, recent);
  return false;
}

export function isCheckoutRateLimited(userId: string, eventId: string) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const blockMs = 30 * 60 * 1000;
  const limit = 5;
  if ((store.checkoutBlockedUntil.get(userId) ?? 0) > now) return true;

  const key = `${userId}:${eventId}`;
  const current = store.checkoutLimits.get(key) ?? { attempts: [] };
  const recent = current.attempts.filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    store.checkoutLimits.set(key, { attempts: recent });
    store.checkoutBlockedUntil.set(userId, now + blockMs);
    return true;
  }

  recent.push(now);
  store.checkoutLimits.set(key, { attempts: recent });
  return false;
}
