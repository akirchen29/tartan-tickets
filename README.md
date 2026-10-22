# Tartan Tickets

A responsive Next.js campus-events prototype based on the supplied Tartan Tickets specs.

## Run locally

```sh
npm install
DEMO_MODE=true SESSION_SECRET=local-preview-secret-change-me npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use either demo account from the sign-in dialog. Demo sessions are signed, HTTP-only cookies; the API checks the session and officer role instead of trusting the UI.

## Prototype limits

The local preview uses seeded events and process memory. Orders, tickets, and waitlists reset when the server restarts and are not shared across multiple server instances. Paid checkout is simulated: no payment is collected, no receipt is sent, and the preview must not be used for real events or student data.

This is not a production deployment of the requirements. The supplied specs call for PostgreSQL-backed transactions, CMU SSO, Stripe Checkout and verified/idempotent webhooks, notifications, durable audit logs, expiration/anonymization jobs, and comprehensive automated acceptance/security/concurrency tests. Those services are not configured or represented as operational by this preview. Before production use, implement and configure those integrations, then exercise every requirement in the test spec.

## Environment

`.env.example` lists integration variable names only. Never put real credentials in source control. `DEMO_MODE=true` is for local preview only and is explicitly rejected in production. `SESSION_SECRET` is required to issue preview sessions.

## Included preview flows

- Browse, search, and filter seeded upcoming events.
- Create a short-lived demo session as a student or Scotty Sound officer.
- Reserve up to four tickets with server-side inventory checks; sold-out events expose a waitlist action.
- View demo tickets and one-time random ticket tokens.
- Create club events and view or export the hosting club's attendee list as CSV.
- Officer-only ticket check-in endpoint rejects repeated scans.
