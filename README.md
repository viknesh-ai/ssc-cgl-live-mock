# SSC CGL Tier-I Live Mock

A proctored mock-examination platform for SSC CGL Tier-I: 100 questions in four
15-minute sections, live invigilation over camera, an examiner console that
marks answers as candidates write them, and an AI review that explains any
question once the paper is done.

## Stack

| Concern | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Data | Postgres via Prisma 7 (Railway Postgres) |
| Realtime | `ws` websocket server attached to the Next.js HTTP server |
| Identity | Firebase Authentication, Google sign-in only |
| Proctoring | WebRTC (STUN, optional TURN) with a snapshot fallback |
| AI review | EURI chat-completions (`gemini-2.5-pro` by default) |
| Hosting | Railway — one web service plus the Postgres database |

Everything runs in one process on one port: Next.js serves the pages and the
REST API, and the websocket upgrade on `/ws` is handled by the same server.

## How it works

**Rooms.** The examiner creates a room and gets a six-character code
(`KX4M2P`). Candidates enter that code, or open `/exam/KX4M2P` directly. There
are no UUIDs anywhere in the product surface.

**Papers.** On joining, a candidate is dealt 25 questions per section, preferring
questions they have not been served before. Re-joining or reloading returns the
same paper. The answer key never leaves the server until the paper is submitted.

**The clock.** Each section runs on its own 15-minute clock, held by the server.
Submitting a section early opens the next one on a fresh clock — unused time
does not carry forward. Pausing the room freezes every candidate's clock and
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
   | `EXAMINER_EMAIL` | the Google account that runs exams |
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
   domains → add `your-app.up.railway.app`. Google sign-in fails without this.
6. **Enable Google sign-in** in Firebase: Authentication → Sign-in method →
   Google.

The first deploy applies `prisma/migrations` and loads the 100 questions from
`prisma/questions.json`. Re-running the seed updates existing questions rather
than duplicating them, so redeploys are safe.

### Who is the examiner

Exactly one account, set by `EXAMINER_EMAIL`. That account gets the examiner
console at `/admin`; everyone else is a candidate. The role is decided on the
server from the verified Google token — it cannot be set from the browser.

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

## Editing the question bank

Questions live in `prisma/questions.json`:

```json
{
  "section": "REASONING",
  "text": "Select the number that will come next in the series: 6, 11, 21, 36, 56, ?",
  "options": ["71", "76", "81", "86"],
  "answerIndex": 2
}
```

`section` is one of `REASONING`, `GENERAL_AWARENESS`, `QUANTITATIVE`, `ENGLISH`;
`answerIndex` is 0-based. Each section needs at least 25 questions. Run
`npm run db:seed` (or redeploy) to load changes. Questions are matched on their
exact text, so editing the text of an existing question adds a new one — change
the options or the answer instead when you mean to correct a question.

Adding more than 25 per section is worthwhile: papers prefer questions a
candidate has not seen before, so a larger bank means repeat attempts stay
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

## Notes

This is a private mock-exam tool, not an accredited assessment platform. Camera
streams are never recorded or written to disk — they are relayed live and
discarded.
