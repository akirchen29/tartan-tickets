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

## Security spec audit

| Requirement | Status | Why |
|---|---|---|
| SEC-1 | Partly | Preview sign-in accepts typed names and stores no passwords, but does not authenticate users through CMU SSO. |
| SEC-2 | Partly | Signed sessions expire eight hours after issuance, not after eight hours of inactivity. |
| SEC-3 | Not at all | HTTPS-only service and HSTS are not configured by the app. |
| SEC-4 | Partly | Protected APIs check a signed preview session and some role/club fields, but identities and roles are not verified and public endpoints have no such check. |
| SEC-5 | Partly | Some club-scoped requests return access-denied/not-found responses, but denied attempts are not logged and refund access is not implemented. |
| SEC-6 | Partly | Order listing and release are scoped to the session user and missing orders return not found, but preview users can claim arbitrary names and tickets are not fully implemented. |
| SEC-7 | Not at all | Paid tickets use simulated checkout; Stripe Checkout is not integrated. |
| SEC-8 | Partly | The browser cannot supply an amount and order data uses server-side event data, but no charge is calculated or processed. |
| SEC-9 | Not at all | There is no Stripe webhook endpoint or signature verification. |
| SEC-10 | Not at all | There is no Stripe event processing or event-ID deduplication. |
| SEC-11 | Partly | No Stripe keys are present in the repository, but there is no secrets-manager or live-versus-test key setup. |
| SEC-12 | Not at all | Connected Stripe accounts, payout redirection, and the required approvals are not implemented. |
| SEC-13 | Partly | Tickets get server-stored, personal-data-free 128-bit random tokens, but the UI shows only a truncated token and does not encode a usable QR code. |
| SEC-14 | Partly | Sequential repeat scans return “Already used,” but check-in is not atomic and simultaneous scans can race. |
| SEC-15 | Not at all | Invalid scans are not counted or rate-limited, and officers are not notified. |
| SEC-16 | Partly | Each preview account is limited to five checkout starts per event in ten minutes; a sixth start blocks all checkouts for that account for 30 minutes. The in-memory limit is not shared or durable across instances/restarts, and preview identities are unverified. |
| SEC-17 | Not at all | Records include extra fields such as user ID, event ID, seat count, timestamps, and ticket tokens beyond the permitted purchase data. |
| SEC-18 | Not at all | No 90-day post-event attendee-data deletion or retention job exists. |
| SEC-19 | Partly | Club officers can export their event’s list with the specified three CSV fields, but exports are not logged; the attendee API also returns extra fields. |
| SEC-20 | Fully | Officer-entered event text is rendered as React text, which escapes it rather than interpreting it as HTML. |
| SEC-21 | Not at all | No audit logging is implemented for the specified actions. |
| SEC-22 | Not at all | Append-only, admin-only, one-year audit-log storage is not implemented. |

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
