import type { DemoUser } from "@/lib/session";

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

type TartanStore = {
  orders: TicketOrder[];
  waitlist: Map<string, Set<string>>;
  requestTimes: Map<string, number[]>;
};

const globalForStore = globalThis as typeof globalThis & { tartanStore?: TartanStore };
export const store: TartanStore = globalForStore.tartanStore ?? (globalForStore.tartanStore = {
  orders: [],
  waitlist: new Map(),
  requestTimes: new Map(),
});

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
