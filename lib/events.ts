export type EventItem = {
  id: string;
  title: string;
  club: string;
  category: string;
  date: string;
  time: string;
  location: string;
  priceCents: number;
  capacity: number;
  sold: number;
  description: string;
  color: string;
  status: "published" | "cancelled";
};

export const initialEvents: EventItem[] = [
  {
    id: "fall-fest",
    title: "Fall Fest: The Afterparty",
    club: "Scotty Sound",
    category: "MUSIC",
    date: "2026-10-30",
    time: "8:00 PM",
    location: "Rangos Ballroom",
    priceCents: 1200,
    capacity: 240,
    sold: 240,
    description: "One big night, one dance floor, all your favorite people. Come through for a live set from campus DJs and a few surprises.",
    color: "lavender",
    status: "published",
  },
  {
    id: "late-night-lab",
    title: "Late Night at the Museum",
    club: "Arts Greenhouse",
    category: "ARTS & CULTURE",
    date: "2026-11-02",
    time: "7:30 PM",
    location: "The Hunt Library",
    priceCents: 800,
    capacity: 180,
    sold: 112,
    description: "The stacks after dark. Explore student installations, live poetry, and tiny bites tucked into unexpected corners of the library.",
    color: "peach",
    status: "published",
  },
  {
    id: "terrace-sessions",
    title: "Terrace Sessions: Vol. 04",
    club: "Scotty Sound",
    category: "MUSIC",
    date: "2026-11-06",
    time: "6:00 PM",
    location: "Cohon University Center",
    priceCents: 0,
    capacity: 120,
    sold: 76,
    description: "An intimate evening of new sounds from CMU's own. Bring a friend, grab a seat, and stay for the whole set.",
    color: "blue",
    status: "published",
  },
  {
    id: "makers-market",
    title: "The Makers Market",
    club: "Design Collective",
    category: "COMMUNITY",
    date: "2026-11-12",
    time: "11:00 AM",
    location: "Morewood Gardens",
    priceCents: 500,
    capacity: 200,
    sold: 58,
    description: "A little market for big ideas. Shop art, prints, ceramics, and one-of-a-kind pieces made right here on campus.",
    color: "green",
    status: "published",
  },
];

const globalForEvents = globalThis as typeof globalThis & { tartanEvents?: EventItem[] };
export const events = globalForEvents.tartanEvents ?? (globalForEvents.tartanEvents = structuredClone(initialEvents));

export function getEvent(eventId: string) {
  return events.find((event) => event.id === eventId && event.status === "published");
}
