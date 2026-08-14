// Independent checker for questions.js.
// Recomputes every calculable answer from scratch and compares it against the
// stored key, so a wrong `ans` index fails loudly instead of reaching a candidate.
// Run: node tools/verify-questions.js

const path = require("path");
global.window = {};
require(path.join(__dirname, "..", "questions.js"));
const Q = global.window.QUESTIONS;

const SECTIONS = [
  "General Intelligence & Reasoning",
  "General Awareness",
  "Quantitative Aptitude",
  "English Language & Comprehension"
];

let fail = 0;
const bad = m => { console.log("  ✗ " + m); fail++; };
const byId = id => Q.find(q => q.id === id);

/* ---------- 1. structural integrity ---------- */
console.log("STRUCTURE");
if (Q.length !== 100) bad(`expected 100 questions, found ${Q.length}`);
if (new Set(Q.map(q => q.id)).size !== Q.length) bad("duplicate question ids");
SECTIONS.forEach(s => {
  const n = Q.filter(q => q.sec === s).length;
  if (n !== 25) bad(`section "${s}" has ${n} questions, expected 25`);
});
Q.forEach(q => {
  if (!q.q || typeof q.q !== "string") bad(`Q${q.id}: missing question text`);
  if (!Array.isArray(q.opts) || q.opts.length !== 4) bad(`Q${q.id}: needs exactly 4 options`);
  if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans > 3) bad(`Q${q.id}: ans out of range`);
  const norm = q.opts.map(o => String(o).trim().toLowerCase());
  if (new Set(norm).size !== norm.length) bad(`Q${q.id}: duplicate options — ambiguous key`);
  if (q.opts.some(o => !String(o).trim())) bad(`Q${q.id}: blank option`);
});
const texts = Q.map(q => q.q.trim().toLowerCase());
if (new Set(texts).size !== texts.length) bad("duplicate question text");
if (!fail) console.log("  ✓ 100 questions, 25 per section, 4 distinct options each, ids unique");

/* ---------- 2. answer-position spread ---------- */
console.log("\nANSWER KEY SPREAD (a flat exam would cluster on one letter)");
const dist = [0, 0, 0, 0];
Q.forEach(q => dist[q.ans]++);
console.log(`  A=${dist[0]}  B=${dist[1]}  C=${dist[2]}  D=${dist[3]}`);
if (Math.max(...dist) > 40) bad("answer key is too clustered on one option");
else console.log("  ✓ reasonably distributed");

/* ---------- 3. helpers ---------- */
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// Compare a computed value against the stored correct option's text.
function expect(id, want) {
  const q = byId(id);
  if (!q) return bad(`Q${id} missing`);
  const got = String(q.opts[q.ans]);
  const digits = s => String(s).replace(/[^0-9.]/g, "");
  const ok = typeof want === "number"
    ? Math.abs(parseFloat(digits(got).replace(/^\./, "0.")) - want) < 1e-6
    : String(want).toLowerCase() === got.toLowerCase();
  if (!ok) bad(`Q${id}: key says "${got}" but computation gives "${want}"`);
  return ok;
}

/* ---------- 4. quantitative aptitude, recomputed ---------- */
console.log("\nQUANTITATIVE APTITUDE (25 recomputed independently)");
expect(51, 1200 * 1.25 * 0.8);                                  // 1200
expect(52, ((800 * 1.4 * 0.85 - 800) / 800) * 100);             // 19%
expect(53, 8000 * Math.pow(10 / 100, 2));                        // 80
expect(54, "7 1/5 days");
if (Math.abs(1 / (1 / 12 + 1 / 18) - 7.2) > 1e-9) bad("Q54: 1/(1/12+1/18) is not 7.2");
expect(55, "3 3/7 hours");
if (Math.abs(1 / (1 / 6 + 1 / 8) - 24 / 7) > 1e-9) bad("Q55: combined rate wrong");
expect(56, (180 + 270) / (54 * 5 / 18));                         // 30 s
expect(57, 48 / (10 + 2));                                       // 4 h
expect(58, 5 * 27 - 4 * 25);                                     // 35
expect(59, "9 : 12 : 14");
{ // A:B=3:4, B:C=6:7 -> scale B to lcm(4,6)=12
  const A = 3 * 3, B = 4 * 3, C = 7 * 2;
  if (`${A} : ${B} : ${C}` !== "9 : 12 : 14") bad("Q59: ratio chain wrong");
}
{ const a = 12000 * 12, b = 18000 * 8; expect(60, 24000 * a / (a + b)); }   // 12000
{ const milk = 40 * 3 / 4, water = 40 / 4; const x = (2 * milk / 3) - water; expect(61, x); } // 10
expect(62, 5 * 5 - 2);                                           // 23
expect(63, Math.pow(10, 3) - 3 * 21 * 10);                       // 370
{ const s = (13 + 14 + 15) / 2; expect(64, Math.sqrt(s * (s - 13) * (s - 14) * (s - 15))); } // 84
expect(65, (90 / 360) * (22 / 7) * 49);                          // 38.5
expect(66, 2 * (22 / 7) * 7 * 10);                               // 440
{ const side = Math.cbrt(1728); expect(67, 6 * side * side); }   // 864
expect(68, "3/4");
{ const sin = 3 / 5, cos = Math.sqrt(1 - sin * sin); if (Math.abs(sin / cos - 0.75) > 1e-9) bad("Q68: tan wrong"); }
expect(69, "1/2");
{ const v = Math.pow(Math.sin(Math.PI / 6), 2) + Math.pow(Math.cos(Math.PI / 3), 2);
  if (Math.abs(v - 0.5) > 1e-9) bad("Q69: sin^2 30 + cos^2 60 is not 1/2"); }
expect(70, 30 * Math.sqrt(3) * Math.tan(Math.PI / 6));           // 30
expect(71, gcd(200 - 5, 320 - 5));                               // 15
expect(72, 12 * 336 / 84);                                       // 48
expect(73, 10000 * Math.pow(1.1, 2) - 10000);                    // 2100
expect(74, 0.15 * 480 + 0.25 * 320);                             // 152
expect(75, 1200 / 1.2);                                          // 1000

/* ---------- 5. reasoning, recomputed ---------- */
console.log("\nREASONING (calculable items recomputed)");
{ // Q1: second difference is constant at 5
  const s = [6, 11, 21, 36, 56]; const d = s.slice(1).map((v, i) => v - s[i]);
  expect(1, s[s.length - 1] + d[d.length - 1] + 5);
}
expect(2, 47 * 2 + 1);                                           // 95
expect(3, 6 * 6 + 1);                                            // 37
{ // Q4: B D G K P -> gaps 2,3,4,5 then 6
  const pos = "BDGKP".split("").map(c => c.charCodeAt(0) - 64);
  const next = pos[pos.length - 1] + 6;
  expect(4, String.fromCharCode(64 + next));                     // V
}
{ // Q5: first letter +2, second letter -2
  expect(5, String.fromCharCode(69 + 2) + String.fromCharCode(86 - 2)); // GT
}
{ // Q6: shift each letter +1
  const enc = w => w.split("").map(c => String.fromCharCode(((c.charCodeAt(0) - 65 + 1) % 26) + 65)).join("");
  if (enc("TIGER") !== "UJHFS") bad("Q6: the stated rule does not reproduce UJHFS");
  expect(6, enc("LION"));                                        // MJPO
}
expect(7, "GARDEN".split("").reverse().join(""));                 // NEDRAG
expect(8, "MAT".split("").reduce((t, c) => t + (c.charCodeAt(0) - 64), 0)); // 34
expect(9, Math.pow(9, 3));                                        // 729
expect(10, Math.pow(18, 2));                                      // 324
{ // Q12: the odd one is the non-square
  const nums = [121, 144, 169, 180];
  const odd = nums.filter(n => !Number.isInteger(Math.sqrt(n)));
  if (odd.length !== 1) bad("Q12: not exactly one non-square");
  expect(12, odd[0]);                                             // 180
}
{ // Q13: the odd one is the non-prime
  const isPrime = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return n > 1; };
  const nums = [31, 37, 41, 51];
  const odd = nums.filter(n => !isPrime(n));
  if (odd.length !== 1) bad("Q13: not exactly one composite");
  expect(13, odd[0]);                                             // 51
}
expect(15, 45 - 18 + 1);                                          // 28
expect(16, 12 + 20 - 1);                                          // 31
expect(23, 12 * (3 - 2));                                         // 12 two-face cubes
{ // Q24: + means /, / means -, - means *, * means +
  expect(24, 16 / 4 - 5 * 2 + 6);                                 // 0
}
{ // Q25: real dictionary sort
  const words = ["Precious", "Precise", "Precedent", "Preclude"];
  const order = [...words].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
  expect(25, order.map(w => words.indexOf(w) + 1).join(", "));    // "3, 1, 2, 4"
}

/* ---------- 6. summary ---------- */
console.log("\n" + "=".repeat(52));
if (fail) { console.log(`FAILED — ${fail} problem(s) found`); process.exit(1); }
console.log("PASSED — every calculable answer matches its key.");
console.log("Note: General Awareness and English items are factual/linguistic");
console.log("and are reviewed by hand, not machine-checked.");
