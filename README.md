# Invigil

An invigilated mock-examination platform. Candidates sit timed papers under
camera supervision; the examiner watches progress and marks live; afterwards an
AI explains any question the candidate wants worked through.

The first paper is SSC CGL Tier-I — 100 questions in four 15-minute sections —
but nothing is hardcoded to it: exams, their sections, the papers drawn from
them and the questions themselves all live in the database and are managed from
the examiner console.

## Stack

| Concern | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Data | Postgres via Prisma 7 (Railway Postgres) |
| Realtime | `ws` websocket server attached to the Next.js HTTP server |
| Identity | Firebase (Google) for candidates, signed session cookie for examiners |
| Proctoring | WebRTC (STUN, optional TURN) with a snapshot fallback |
| AI review | EURI chat-completions (`gemini-2.5-pro` by default) |
| Hosting | Railway — one web service plus the Postgres database |

Everything runs in one process on one port: Next.js serves the pages and the
REST API, and the websocket upgrade on `/ws` is handled by the same server.

## How it works

**Exams, papers, sessions.** An *exam* owns its sections and marking scheme. A
*paper* is a blueprint over one exam: how many questions to draw from each
section, how long each section runs, and optionally which topic to draw from. A
*session* runs one paper for a group of candidates and gets a six-character code
(`KX4M2P`). Candidates enter that code, or open `/exam/KX4M2P` directly. There
are no UUIDs anywhere in the product surface.

**The question bank.** Every question lives in Postgres with its section, topic,
difficulty and draft/published state, and carries its own statistics — how often
it has been served and what proportion of candidates got it right. Examiners
write, edit, search and bulk-import questions in the console; a question added
now is in the next session, with no redeploy.

**Drawing a paper.** On joining, each candidate is dealt their own set from the
bank, preferring questions they have not been served before. Re-joining or
reloading returns the same paper. The answer key never leaves the server until
the paper is submitted. A session cannot be created if the bank cannot supply
what the paper asks for.

**The clock.** Each section runs on its own clock, held by the server.
Submitting a section early opens the next one on a fresh clock — unused time
does not carry forward. Pausing the session freezes every candidate's clock and
resuming credits the frozen time back.

**Invigilation.** The candidate's camera opens when the exam does. When the
examiner presses *Watch camera*, the candidate's browser offers a WebRTC peer
connection over the websocket. If that connection cannot be formed within nine
seconds — symmetric NAT, corporate firewall — the candidate switches to sending
a small JPEG frame every 1.5 seconds instead, so invigilation never goes dark.
Leaving the exam window is counted and shown to the examiner.

**AI review.** After submitting, every question has an *Explain this answer*
button. The server asks EURI for a worked explanation and stores it against the
question, so the same explanation is generated once and reused for everyone.

## Deploying on Railway

1. **Create the service.** New Project → Deploy from GitHub repo → this repo.
   Railway reads `railway.json`: it builds with Nixpacks, runs migrations and the
   question seed as a pre-deploy step, then starts the server.
2. **Add Postgres.** In the same project: New → Database → PostgreSQL.
3. **Set the service variables** (Settings → Variables):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `ADMIN_USERNAME` | examiner login, e.g. `examiner` |
   | `ADMIN_PASSWORD` | examiner password, shared by all examiners |
   | `ADMIN_SESSION_SECRET` | any long random string; signs session cookies |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from the Firebase web app config |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | your Firebase project id |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from the Firebase web app config |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from the Firebase web app config |
   | `EURI_API_KEY` | your EURI key |
   | `EURI_MODEL` | `gemini-2.5-pro` (optional) |

4. **Generate a domain** (Settings → Networking → Generate Domain). Railway
   proxies websockets on the same domain, so nothing else is needed for `/ws`.
5. **Authorise the domain in Firebase**: Authentication → Settings → Authorized
   domains → add `your-app.up.railway.app`. Google sign-in fails without this,
   on every device.
6. **Enable Google sign-in** in Firebase: Authentication → Sign-in method →
   Google.

The first deploy applies `prisma/migrations` and loads the 100 questions from
`prisma/questions.json`. Re-running the seed updates existing questions rather
than duplicating them, so redeploys are safe.

### Signing in

**Candidates** sign in with Google. Firebase's sign-in handler is proxied
through this app's own domain (see `rewrites` in `next.config.ts`), which keeps
the flow first-party — without that, sign-in works on desktop but fails on
phones and anywhere third-party storage is blocked.

**Examiners** go to `/admin` and use the shared username and password from
`ADMIN_USERNAME` / `ADMIN_PASSWORD`. Each browser gets its own signed session
cookie, so several examiners can invigilate the same room at the same time, from
whatever device is to hand. Sessions last 30 days; changing `ADMIN_PASSWORD` (or
`ADMIN_SESSION_SECRET`) signs everyone out.

Optionally, setting `EXAMINER_EMAIL` also grants examiner rights to that one
Google account. It is not required.

### Camera through restrictive networks (optional)

STUN handles most home and mobile networks. If a candidate is behind a network
that blocks peer-to-peer entirely they fall back to still frames automatically.
To get full video in those cases too, add a TURN server:

```
NEXT_PUBLIC_TURN_URL=turn:your-turn-host:3478
NEXT_PUBLIC_TURN_USERNAME=...
NEXT_PUBLIC_TURN_CREDENTIAL=...
```

## Running locally

```bash
npm install
cp .env.example .env          # then fill in the values
npx prisma migrate deploy     # create the schema
npm run db:seed               # load the question bank
npm run dev                   # http://localhost:3000
```

`npm run dev` runs the same custom server as production, so websockets, camera
signalling and chat all work locally.

## Seeding questions from a file

The console is the normal way to manage questions. `prisma/questions.json` seeds
the starting bank on first deploy and tops up anything missing afterwards:

```json
{
  "section": "REASONING",
  "text": "Select the number that will come next in the series: 6, 11, 21, 36, 56, ?",
  "options": ["71", "76", "81", "86"],
  "answerIndex": 2
}
```

`section` names a section of the seeded exam; `answerIndex` is 0-based. Run
`npm run db:seed` (or redeploy) to load changes. Questions are matched on their
exact text, so editing text in the file adds a new question rather than changing
the old one — use the console to correct a question that already exists.

A bank larger than a paper needs is worthwhile: papers prefer questions a
candidate has not seen before, so more questions mean repeat attempts stay
fresh.

## Project layout

```
server.ts                  Next.js + websocket entry point
prisma/schema.prisma       Data model
prisma/questions.json      The question bank
src/app/                   Pages and REST API routes
src/components/            UI: exam runner, examiner console, primitives
src/hooks/                 Websocket, camera publisher, camera viewer
src/lib/                   Exam rules, scoring, auth, EURI client
src/server/                Websocket server and connection registry
```

## The examiner console

`/admin`, behind the shared examiner login:

- **Sessions** — create a session from a paper, share its code, and invigilate:
  live candidate table, answer sheet marked as they work, camera, chat, and
  start/pause/end controls.
- **Papers** — create and edit blueprints. Each section gets its own question
  count, duration and optional topic filter, and the page shows how many
  published questions the bank actually holds for it.
- **Question bank** — filter by section, topic, difficulty, status or text;
  write and edit questions; bulk import by pasting JSON; see how each question
  has performed. Questions that have already been served are retired to drafts
  rather than deleted, so past results keep their questions.

## Adding another exam

Exams are rows, not code. Insert an `Exam` with its `ExamSection`s (or extend
`prisma/seed.ts`), add questions to the bank against those sections, then create
a paper over them. `APP_NAME` in `src/lib/brand.ts` is the only naming constant
left in the source.

## Notes

This is a private mock-exam tool, not an accredited assessment platform. Camera
streams are never recorded or written to disk — they are relayed live and
discarded.
