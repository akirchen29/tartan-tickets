# Tartan Tickets

A responsive Next.js campus-events prototype based on the supplied Tartan Tickets specs.

## Run locally

```sh
npm install
DEMO_MODE=true SESSION_SECRET=local-preview-secret-change-me npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter a name and choose a preview role in the sign-in dialog. This creates a temporary preview identity; it is not real authentication.

## Tests

Run the Story 4 waitlist API and storage tests with:

```sh
npm test
```

## Prototype limits

The app uses seeded events and in-memory server data. Orders, tickets, waitlists, and seat holds are not durable or shared between server instances, and reset on every deploy (and whenever the server restarts). Waitlist seat holds expire after 30 minutes and are processed on app requests.

Real payments and real authentication are non-goals for this homework. Paid tickets use a **Simulated payment** button; no card is charged and no receipt is sent. Names typed into the preview are not verified, and preview roles are not secure. Do not use this app for real events or student data.

## Environment

`DEMO_MODE=true` enables preview sessions and `SESSION_SECRET` is required to sign the temporary session cookie. Never put real credentials in source control. This prototype is not a production deployment of the requirements: database persistence, university authentication, real payments, verified payment webhooks, email delivery, durable audit logs, data-retention jobs, and comprehensive acceptance/security/concurrency tests are not implemented.

## Included preview flows

- Browse, search, and filter seeded upcoming events.
- Create a preview session with a typed name as a student or Scotty Sound officer.
- Reserve up to four tickets with server-side inventory checks; paid tickets use simulated payment.
- Join a sold-out event's waitlist; when seats are released, the first person in line receives an in-app notification and a 30-minute hold.
- Release a demo ticket to open seats for the next waitlisted person; claim an offered seat before its hold expires.
- View demo tickets and one-time random ticket tokens.
- Create club events and view or export the hosting club's attendee list as CSV.
- Officer-only ticket check-in endpoint rejects repeated scans.
