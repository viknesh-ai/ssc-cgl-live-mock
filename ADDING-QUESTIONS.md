# Adding questions

All questions live in **`questions.js`**. That file never reaches the browser —
it is compiled into the Cloudflare Worker, so the answer key stays server-side.

## The template

Copy this block, fill it in, add it to the list in `questions.js`:

```js
{
  id:   101,                                 // any whole number, must be unique
  sec:  "Quantitative Aptitude",             // must match one of the 4 names below EXACTLY
  q:    "What is 15% of 480 + 25% of 320?",  // the question text
  opts: ["142", "148", "158", "152"],        // exactly 4 options, all different
  ans:  3                                    // which option is correct: 0=A, 1=B, 2=C, 3=D
},
```

`ans` is a **position, not a value**. In the example above `ans: 3` means the
4th option (`"152"`) is correct, because counting starts at 0.

## The four section names

Spelling must match exactly, including the `&`:

```
General Intelligence & Reasoning
General Awareness
Quantitative Aptitude
English Language & Comprehension
```

## How many to add

Each student's paper draws **25 random questions per section**. The more you add,
the longer a student can practise without seeing a repeat:

| Questions per section | Fresh papers before any repeat |
|---|---|
| 25  | 1 |
| 100 | 4 |
| 250 | 10 |

The app tracks what each student has already been shown, keyed to their account,
and excludes those questions from their next paper. When a student exhausts a
section's pool it starts over rather than serving a short paper.

## After editing

```bash
node tools/verify-questions.js   # catches broken keys and ambiguous options
node tools/sync-bank.js          # validates and copies into the Worker
cd worker && wrangler deploy     # publish
```

`sync-bank.js` refuses to sync if anything is wrong, and tells you which
question and what to fix. Things it catches:

- a duplicate `id`
- a misspelt section name
- more or fewer than 4 options
- two identical options (which would make the answer ambiguous)
- `ans` outside 0–3
- a section with fewer than 25 questions
- blank question text or options

`verify-questions.js` additionally recomputes every calculable answer — the
maths and reasoning items — and fails if a stored key disagrees with the actual
result. It cannot check facts in General Awareness or English; review those by
hand.
