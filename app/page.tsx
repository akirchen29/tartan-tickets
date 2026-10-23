"use client";

import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown,
  Clock3, Compass, MapPin, Menu, Music2, Plus, Search, ShieldCheck, Sparkles,
  Ticket, TicketCheck, Users, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventItem } from "@/lib/events";
import type { DemoUser } from "@/lib/session";

type Order = {
  id: string;
  eventId: string;
  seats: number;
  tickets: { token: string; checkedInAt: string | null }[];
};
type WaitlistNotification = {
  id: string;
  eventId: string;
  eventTitle: string;
  status: "active" | "claimed" | "expired";
  createdAt: string;
  holdExpiresAt: string;
};
type View = "discover" | "tickets" | "organize";
const filters = ["All events", "Music", "Arts & Culture", "Community"];
const money = (cents: number) => cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}`;
const dateParts = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return { month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), day: date.getDate(), full: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) };
};

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<WaitlistNotification[]>([]);
  const [filter, setFilter] = useState("All events");
  const [view, setView] = useState<View>("discover");
  const [search, setSearch] = useState("");
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInName, setSignInName] = useState("");
  const [seatCount, setSeatCount] = useState(1);
  const [attendees, setAttendees] = useState<{ name: string; email: string; checkedInAt: string | null; seats: number }[]>([]);
  const [organizeEvent, setOrganizeEvent] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [eventResponse, sessionResponse] = await Promise.all([fetch("/api/events"), fetch("/api/session")]);
      if (!eventResponse.ok || !sessionResponse.ok) throw new Error("Couldn't load the latest events.");
      const eventData = await eventResponse.json();
      const sessionData = await sessionResponse.json();
      setEvents(eventData.events);
      setUser(sessionData.user);
      if (sessionData.user) {
        const [orderResponse, notificationResponse] = await Promise.all([
          fetch("/api/orders"), fetch("/api/waitlist"),
        ]);
        if (!orderResponse.ok || !notificationResponse.ok) throw new Error("Couldn't load your tickets and waitlist updates.");
        setOrders((await orderResponse.json()).orders);
        setNotifications((await notificationResponse.json()).notifications);
      } else {
        setOrders([]);
        setNotifications([]);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const checkNotifications = async () => {
      try {
        const response = await fetch("/api/waitlist");
        if (!response.ok) throw new Error("Couldn't check your waitlist updates.");
        const result = await response.json();
        if (!stopped) setNotifications(result.notifications);
      } catch (error) {
        if (!stopped) setNotice(error instanceof Error ? error.message : "Couldn't check your waitlist updates.");
      }
    };
    void checkNotifications();
    const interval = window.setInterval(() => void checkNotifications(), 5000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [user?.id]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesFilter = filter === "All events" || event.category.toLowerCase() === filter.toLowerCase();
    const term = search.trim().toLowerCase();
    return matchesFilter && (!term || `${event.title} ${event.club} ${event.location}`.toLowerCase().includes(term));
  }), [events, filter, search]);

  async function signIn(role: "student" | "officer") {
    setBusy(true);
    const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: signInName, role }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(result.error); return; }
    setUser(result.user);
    setSignInOpen(false);
    setSignInName("");
    setNotice(`Welcome in, ${result.user.name.split(" ")[0]}.`);
    await refresh();
  }

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    setUser(null);
    setOrders([]);
    setView("discover");
    setNotice("You’re signed out.");
  }

  async function buy(event: EventItem) {
    if (!user) { setSignInOpen(true); return; }
    setBusy(true);
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, seats: seatCount }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(result.error); if (response.status === 409) void refresh(); return; }
    setOrders((previous) => [result.order, ...previous]);
    setEvents((previous) => previous.map((item) => item.id === event.id ? { ...item, sold: item.sold + seatCount } : item));
    setActiveEvent(null);
    setSeatCount(1);
    setView("tickets");
    setNotice(event.priceCents ? "Demo ticket reserved. No payment was processed." : "Your free ticket is confirmed.");
  }

  async function joinWaitlist(event: EventItem) {
    if (!user) { setSignInOpen(true); return; }
    const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id }) });
    const result = await response.json();
    setNotice(response.ok ? `You’re on the list — position ${result.position}.` : result.error);
  }

  async function claimWaitlistOffer(offer: WaitlistNotification) {
    setBusy(true);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId: offer.id }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(result.error); await refresh(); return; }
    setOrders((previous) => [result.order, ...previous]);
    setNotifications((previous) => previous.map((item) => item.id === offer.id ? { ...item, status: "claimed" } : item));
    setView("tickets");
    setNotice("Your held seat is confirmed. No real payment was processed.");
    await refresh();
  }

  async function releaseOrder(orderId: string) {
    if (!window.confirm("Release this demo ticket and offer the seat to the next person on the waitlist?")) return;
    const response = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error); return; }
    setNotice(`Released ${result.released} seat${result.released === 1 ? "" : "s"}. The next waitlisted person will be notified.`);
    await refresh();
  }

  async function loadAttendees(eventId: string) {
    setOrganizeEvent(eventId);
    const response = await fetch(`/api/officers/attendees?eventId=${encodeURIComponent(eventId)}`);
    const result = await response.json();
    if (!response.ok) { setNotice(result.error); return; }
    setAttendees(result.attendees);
  }

  async function downloadCsv() {
    if (!organizeEvent) return;
    const response = await fetch(`/api/officers/attendees?eventId=${encodeURIComponent(organizeEvent)}&format=csv`);
    if (!response.ok) { setNotice("Unable to export this attendee list."); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `${organizeEvent}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createEvent(formData: FormData) {
    const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      title: formData.get("title"), date: formData.get("date"), time: formData.get("time"),
      location: formData.get("location"), category: formData.get("category"),
      capacity: Number(formData.get("capacity")), priceCents: Math.round(Number(formData.get("price")) * 100),
      description: formData.get("description"),
    }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error); return; }
    setEvents((previous) => [result.event, ...previous]);
    setCreateOpen(false);
    setNotice("Your event is live.");
  }

  const myOrders = orders.map((order) => ({ ...order, event: events.find((event) => event.id === order.eventId) })).filter((order) => order.event);
  const soldOut = (event: EventItem) => event.capacity <= event.sold;
  const eventCard = (event: EventItem, index: number) => {
    const remaining = Math.max(0, event.capacity - event.sold);
    const date = dateParts(event.date);
    return (
      <article className="event-card" key={event.id} style={{ animationDelay: `${index * 70}ms` }}>
        <button className={`event-art art-${event.color}`} onClick={() => { setActiveEvent(event); setSeatCount(1); }} aria-label={`View ${event.title}`}>
          <span className="art-grain" />
          <span className="art-tag">{event.category}</span>
          {event.color === "lavender" ? <div className="record-art"><span /><i /></div> : event.color === "peach" ? <div className="museum-art"><span /><i /><b /></div> : event.color === "blue" ? <Music2 className="floating-note" /> : <div className="market-art"><Sparkles /><span /><i /></div>}
          <span className="event-date"><b>{date.month}</b><strong>{date.day}</strong></span>
          <span className="art-open"><ArrowUpRight size={17} /></span>
        </button>
        <div className="event-info">
          <div className="event-meta"><span>{event.club}</span><span className="meta-dot" />{event.time}</div>
          <button className="event-title" onClick={() => { setActiveEvent(event); setSeatCount(1); }}>{event.title}</button>
          <div className="event-bottom">
            <span><MapPin size={14} />{event.location}</span>
            <strong>{money(event.priceCents)}</strong>
          </div>
          <div className="availability"><span>{soldOut(event) ? "Waitlist open" : `${remaining} spots left`}</span><div><i style={{ width: `${Math.min(100, event.sold / event.capacity * 100)}%` }} /></div></div>
        </div>
      </article>
    );
  };

  return (
    <main>
      <header className="topbar">
        <a href="#" className="brand" onClick={() => setView("discover")} aria-label="Tartan Tickets home"><span className="brand-mark"><Ticket size={19} strokeWidth={2.3} /></span><span>tartan<span className="brand-light">tickets</span></span><sup>CMU</sup></a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "discover" ? "nav-link active" : "nav-link"} onClick={() => setView("discover")}><Compass size={15} /> Discover</button>
          <button className={view === "tickets" ? "nav-link active" : "nav-link"} onClick={() => user ? setView("tickets") : setSignInOpen(true)}><TicketCheck size={15} /> My tickets</button>
          {user?.role === "officer" && <button className={view === "organize" ? "nav-link active" : "nav-link"} onClick={() => setView("organize")}><Users size={15} /> Organize</button>}
        </nav>
        <div className="top-actions">
          <span className="semester"><span /> FALL 2026</span>
          {user ? <button className="user-button" onClick={() => void signOut()} title="End preview session"><span className="avatar">{user.name.split(" ").map((part) => part[0]).join("")}</span><span className="user-name">{user.name.split(" ")[0]}</span><ChevronDown size={14} /></button> : <button className="sign-in" onClick={() => setSignInOpen(true)}>Use preview name <ArrowRight size={15} /></button>}
        </div>
      </header>

      <div className="demo-ribbon"><ShieldCheck size={14} /> DEMO MODE <span>—</span> Tickets and checkout are for preview only. No payment is processed.</div>
      {user && notifications.filter((item) => item.status === "active").length > 0 && <section className="waitlist-notifications" aria-label="Waitlist notifications" aria-live="polite">
        {notifications.filter((item) => item.status === "active").map((offer) => <article className="waitlist-notice" key={offer.id}>
          <div><strong>A seat opened up for {offer.eventTitle}.</strong><span>We’re holding it for you until {new Date(offer.holdExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (30 minutes).</span></div>
          <button className="buy-button" disabled={busy} onClick={() => void claimWaitlistOffer(offer)}>{events.find((event) => event.id === offer.eventId)?.priceCents ? "Simulated payment" : "Claim free seat"} <ArrowRight size={15} /></button>
        </article>)}
      </section>}

      {view === "discover" && <div className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR CAMPUS, YOUR PLANS</div>
            <h1>Make room for<br /><em>something good.</em></h1>
            <p>The little moments, the big nights, the “you had to be there” stories. Find what’s happening at CMU.</p>
            <button className="hero-cta" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>Find your next thing <ArrowDownRight size={16} /></button>
            <div className="hero-foot"><span className="avatar-stack"><i>J</i><i>M</i><i>A</i><i>+</i></span><span><b>1,200+</b> students made plans this week</span></div>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-ticket"><div className="ticket-top"><span>CMU · CAMPUS SERIES</span><span>NO. 0248</span></div><div className="ticket-main"><span className="ticket-small">A NIGHT TO REMEMBER</span><strong>Find your<br />people.</strong><span className="ticket-mark"><Ticket size={46} /></span></div><div className="ticket-bottom"><span>FALL 2026</span><span>CARNEGIE MELLON</span><span>★ ★ ★</span></div><div className="ticket-perf" /></div>
            <div className="hero-sticker"><Sparkles size={15} /> GOOD PLANS<br /><b>LIVE HERE</b></div>
            <span className="hero-scribble">go on, get out <ArrowDownRight size={21} /></span>
          </div>
        </section>

        <section className="events-section" id="events">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> THE GOOD STUFF</div><h2>Coming up <em>on campus</em></h2></div>
            <div className="heading-side"><span className="live-dot" /> {events.length} events worth leaving your room for <ArrowRight size={15} /></div>
          </div>
          <div className="event-tools">
            <div className="filters" role="group" aria-label="Filter events">{filters.map((item) => <button key={item} className={filter === item ? "filter active" : "filter"} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <label className="search-box"><Search size={16} /><input aria-label="Search events" placeholder="Find your thing..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
          </div>
          {loading ? <div className="empty-state"><span className="spinner" /> Finding the good stuff...</div> : visibleEvents.length ? <div className="event-grid">{visibleEvents.map(eventCard)}</div> : <div className="empty-state"><span className="empty-icon"><CalendarDays /></span><strong>No upcoming events yet.</strong><span>Try a different filter or come back soon.</span></div>}
          <div className="section-tail"><span>THAT’S THE LINEUP (FOR NOW)</span><span>GOOD THINGS TAKE TIME <span className="tiny-star">✳</span></span></div>
        </section>

        <section className="club-banner"><div className="banner-icon"><Users size={23} /></div><div><span>FOR THE PEOPLE WHO MAKE IT HAPPEN</span><h3>Your club has a thing? <em>Let’s get a room.</em></h3></div><button onClick={() => user?.role === "officer" ? setView("organize") : setSignInOpen(true)}>Host an event <ArrowRight size={16} /></button><div className="banner-spark">✳</div></section>
      </div>}

      {view === "tickets" && <section className="content-page">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR PLANS</div><h1 className="content-title">Your tickets<span className="title-period">.</span></h1><p className="content-intro">All your campus plans, in one place.</p>
        {!user ? <div className="empty-state"><strong>Enter a preview name to see your tickets.</strong><button className="sign-in" onClick={() => setSignInOpen(true)}>Continue <ArrowRight size={15} /></button></div> : myOrders.length ? <div className="ticket-list">{myOrders.map((order) => <article className="owned-ticket" key={order.id}><div className={`owned-art art-${order.event?.color}`}><Ticket size={28} /></div><div className="owned-info"><span>{order.event?.club} · {dateParts(order.event!.date).full}</span><h2>{order.event?.title}</h2><p>{order.seats} {order.seats === 1 ? "ticket" : "tickets"} · {order.event?.location}</p><button className="text-action" onClick={() => void releaseOrder(order.id)}>Release ticket and open the seat <ArrowRight size={15} /></button></div><div className="ticket-qr" aria-label="Demo ticket QR code"><span>{order.tickets[0]?.token.slice(0, 16)}</span><i>{Array.from({ length: 25 }, (_, index) => <b key={index} className={(index * 7 + index % 4) % 3 ? "filled" : ""} />)}</i><small>DEMO QR TOKEN</small></div></article>)}</div> : <div className="empty-state"><span className="empty-icon"><Ticket /></span><strong>No tickets yet.</strong><span>Find an event and make a plan.</span><button className="text-action" onClick={() => setView("discover")}>Explore events <ArrowRight size={15} /></button></div>}
      </section>}

      {view === "organize" && <section className="content-page">
        <div className="eyebrow"><span className="eyebrow-line" /> CLUB TOOLS · {user?.club?.toUpperCase()}</div><h1 className="content-title">Make it <em>happen.</em></h1><p className="content-intro">Your event, your people. Keep an eye on who's coming.</p>
        <div className="organizer-bar"><label className="select-wrap"><span>YOUR EVENTS</span><select aria-label="Choose event" value={organizeEvent} onChange={(event) => void loadAttendees(event.target.value)}><option value="">Choose an event</option>{events.filter((event) => event.club === user?.club).map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><button className="create-event" onClick={() => setCreateOpen(true)}><Plus size={16} /> Create event</button></div>
        {organizeEvent && <div className="attendee-panel"><div className="attendee-heading"><div><span>LIVE ATTENDEE LIST</span><h2>{attendees.length} {attendees.length === 1 ? "order" : "orders"}</h2></div><button className="outline-button" onClick={() => void downloadCsv()}>Export CSV <ArrowDownRight size={15} /></button></div>{attendees.length ? <div className="attendee-table"><div className="attendee-row attendee-head"><span>NAME</span><span>EMAIL</span><span>CHECK-IN</span></div>{attendees.map((person, index) => <div className="attendee-row" key={`${person.email}-${index}`}><span>{person.name}</span><span>{person.email}</span><span className={person.checkedInAt ? "checked-in" : ""}>{person.checkedInAt ? "Checked in" : "Not checked in"}</span></div>)}</div> : <div className="empty-small">No attendees just yet. Spread the word!</div>}</div>}
        {!organizeEvent && <div className="empty-state"><span className="empty-icon"><Users /></span><strong>Pick an event to see who’s coming.</strong><span>You can create a new one whenever you’re ready.</span></div>}
      </section>}

      <footer className="footer"><a href="#" className="brand footer-brand"><span className="brand-mark"><Ticket size={17} /></span><span>tartan<span className="brand-light">tickets</span></span></a><span>MADE FOR THE MOMENTS BETWEEN CLASSES <span className="tiny-star">✳</span></span><span>CARNEGIE MELLON UNIVERSITY · FALL 2026</span></footer>

      {activeEvent && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveEvent(null); }}><section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close" onClick={() => setActiveEvent(null)}><X size={19} /></button><div className={`modal-art art-${activeEvent.color}`}><span className="art-tag">{activeEvent.category}</span><span className="modal-date">{dateParts(activeEvent.date).month} {dateParts(activeEvent.date).day}</span></div><div className="modal-content"><span className="event-meta">{activeEvent.club} <span className="meta-dot" /> {activeEvent.time}</span><h2 id="modal-title">{activeEvent.title}</h2><p>{activeEvent.description}</p><div className="modal-facts"><span><CalendarDays size={16} />{dateParts(activeEvent.date).full}</span><span><MapPin size={16} />{activeEvent.location}</span><span><Clock3 size={16} />{activeEvent.time}</span></div><div className="purchase-row"><div className="price-block"><strong>{money(activeEvent.priceCents)}</strong><span>per ticket</span></div>{soldOut(activeEvent) ? <button className="buy-button waitlist-button" disabled={busy} onClick={() => void joinWaitlist(activeEvent)}>Join waitlist <ArrowRight size={16} /></button> : <><label className="quantity"><span className="sr-only">Number of tickets</span><select value={seatCount} onChange={(event) => setSeatCount(Number(event.target.value))}>{Array.from({ length: Math.min(4, activeEvent.capacity - activeEvent.sold) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index ? "tickets" : "ticket"}</option>)}</select><ChevronDown size={14} /></label><button className="buy-button" disabled={busy} onClick={() => void buy(activeEvent)}>{busy ? "One sec..." : activeEvent.priceCents ? "Simulated payment" : "Reserve free ticket"} <ArrowRight size={16} /></button></>}</div><span className="secure-note"><ShieldCheck size={13} /> No card details are collected in this demo</span></div></section></div>}

      {signInOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignInOpen(false); }}><section className="signin-modal" role="dialog" aria-modal="true" aria-labelledby="signin-title"><button className="modal-close" aria-label="Close" onClick={() => setSignInOpen(false)}><X size={19} /></button><div className="signin-mark"><Ticket size={24} /></div><div className="eyebrow"><span className="eyebrow-line" /> WELCOME TO THE SHOW</div><h2 id="signin-title">You’re on the list.<br /><em>Almost.</em></h2><p>Enter a name for this preview session. No sign-in provider or real authentication is used.</p><label className="preview-name">Your name<input autoComplete="name" maxLength={80} value={signInName} onChange={(event) => setSignInName(event.target.value)} placeholder="e.g. Jordan Lee" /></label><button className="account-choice" disabled={busy || !signInName.trim()} onClick={() => void signIn("student")}><span className="avatar">{signInName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST"}</span><span><b>Continue as student</b><small>Browse, buy, and manage tickets</small></span><ArrowRight size={17} /></button><button className="account-choice" disabled={busy || !signInName.trim()} onClick={() => void signIn("officer")}><span className="avatar officer-avatar">{signInName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "OF"}</span><span><b>Continue as club officer</b><small>Scotty Sound event tools · preview only</small></span><ArrowRight size={17} /></button><small className="signin-disclaimer">Preview identities can be chosen by anyone and are not secure.</small></section></div>}

      {createOpen && <div className="modal-backdrop"><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="modal-close" aria-label="Close" onClick={() => setCreateOpen(false)}><X size={19} /></button><div className="eyebrow"><span className="eyebrow-line" /> PUT IT ON THE CALENDAR</div><h2 id="create-title">Create an event<span className="title-period">.</span></h2><form action={(formData) => void createEvent(formData)} className="create-form"><label>Event name<input name="title" required maxLength={90} placeholder="Something people will remember" /></label><div className="form-pair"><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" required defaultValue="6:00 PM" /></label></div><label>Location<input name="location" required placeholder="Building, room, or spot on campus" /></label><div className="form-pair"><label>Category<select name="category"><option>Community</option><option>Music</option><option>Arts & Culture</option></select></label><label>Capacity<input name="capacity" type="number" min="1" required defaultValue="100" /></label></div><div className="form-pair"><label>Price per ticket ($)<input name="price" type="number" min="0" step="0.01" required defaultValue="0" /></label><label>Description<input name="description" maxLength={500} placeholder="What's the plan?" /></label></div><button className="buy-button" type="submit">Publish event <ArrowRight size={16} /></button></form></section></div>}

      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15} /></button></div>}
      <button className="mobile-menu" aria-label="Jump to events" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}><Menu size={19} /></button>
    </main>
  );
}
