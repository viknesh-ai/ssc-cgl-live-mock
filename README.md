# SSC CGL Tier-I Live Mock

A quick, free-to-host live exam app for you and one/few friends.

## What it does

- 100 questions: 25 Reasoning + 25 GA + 25 Quant + 25 English
- 4 fixed 15-minute sections = 60 minutes total
- +2 correct / -0.50 wrong
- Candidate link can be shared
- Examiner dashboard can start the room
- Live candidate progress: section, question, attempted, review, status
- Candidate answers are synced to Firebase Realtime Database
- Final section-wise score, accuracy, attempted/wrong/skipped
- Works as a static website; Firebase provides realtime storage/auth

## Recommended free hosting

Cloudflare Pages is a simple choice for the static files. It can deploy a static HTML site from GitHub and gives a `pages.dev` URL.

## Firebase setup

1. Go to Firebase Console and create a project.
2. Add a Web App.
3. Enable Authentication:
   - Authentication -> Sign-in method
   - Enable Email/Password
   - Enable Anonymous
4. Create Realtime Database.
5. Start in locked mode, then replace the database rules with `database.rules.json`.
6. IMPORTANT: in `database.rules.json`, replace:
   REPLACE_WITH_YOUR_ADMIN_EMAIL
   with the exact email you use for the examiner account.
7. Create the examiner email/password account under Authentication -> Users.
8. Copy the Web App config into `firebase-config.js`.
9. Deploy the whole folder.

## How to use

Examiner:
- Open `https://YOUR-SITE/?admin=1`
- Log in with your Firebase examiner email/password.
- Click "Create Room".
- Copy the generated candidate link and send it to your friend.
- When your friend joins, you'll see their live status.
- Click "Start Exam".
- The candidate's 15-minute section timers run from the server start time.
- After each 15-minute block the section is locked automatically.

Candidate:
- Open the shared room link.
- Enter name.
- Wait for examiner to start.
- Take the exam.

## Important

This is a small personal-use mock-exam app, not a production assessment platform.
Do not put sensitive personal information into it.

If you change the question bank, edit `questions.js`.
