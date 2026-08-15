// SSC CGL mock exam backend.
//
// The answer key lives here and never reaches the browser. The client asks for
// a paper (questions only), and gets the key back only after it submits.
// Per-student question history is kept in KV so a student who comes back does
// not see questions they have already been given.

import { BANK } from "./bank.js";

const SECTIONS = [
  "General Intelligence & Reasoning",
  "General Awareness",
  "Quantitative Aptitude",
  "English Language & Comprehension"
];
const PER_SECTION = 25;
const PROJECT_ID = "ssc-cgl-live-mock";
const ADMIN_EMAIL = "jeyaviknesh@gmail.com";

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(), ...extra }
  });

const cors = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization"
});

/* ------------------------- Firebase ID token verify ------------------------- */
// Google publishes the token-signing keys as JWKs, which WebCrypto imports
// directly — no X.509 parsing needed. Cached for the isolate's lifetime.
let jwkCache = { at: 0, keys: null };
async function googleJwks() {
  if (jwkCache.keys && Date.now() - jwkCache.at < 3600e3) return jwkCache.keys;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  const body = await r.json();
  jwkCache = { at: Date.now(), keys: body.keys || [] };
  return jwkCache.keys;
}
const b64url = s => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};
async function verifyIdToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
  if (!payload.sub || !payload.exp || payload.exp < now) return null;
  const jwk = (await googleJwks()).find(k => k.kid === header.kid);
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey(
      "jwk", { kty: jwk.n ? "RSA" : jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, b64url(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    if (!ok) return null;
  } catch { return null; }
  return payload;
}
const bearer = req => (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

/* ------------------------------ paper drawing ------------------------------ */
const stripKey = q => ({ id: q.id, sec: q.sec, q: q.q, opts: q.opts });

function drawPaper(seenIds) {
  const seen = new Set(seenIds || []);
  const picked = [];
  const notes = [];
  for (const sec of SECTIONS) {
    const pool = BANK.filter(q => q.sec === sec);
    let fresh = pool.filter(q => !seen.has(q.id));
    // If the student has exhausted this section's pool, start it over rather
    // than serving a short paper.
    if (fresh.length < PER_SECTION) {
      notes.push(sec);
      fresh = pool;
    }
    const shuffled = fresh.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    picked.push(...shuffled.slice(0, Math.min(PER_SECTION, shuffled.length)));
  }
  return { picked, recycled: notes };
}

function score(paperIds, answers) {
  const byId = new Map(BANK.map(q => [String(q.id), q]));
  const rows = SECTIONS.map(s => ({ sec: s, correct: 0, wrong: 0, skipped: 0, score: 0, accuracy: 0 }));
  let total = 0;
  for (const qid of paperIds) {
    const q = byId.get(String(qid));
    if (!q) continue;
    const row = rows.find(r => r.sec === q.sec);
    const a = answers ? answers[String(qid)] : undefined;
    if (a === undefined || a === null || a === "") row.skipped++;
    else if (Number(a) === q.ans) row.correct++;
    else row.wrong++;
  }
  for (const r of rows) {
    r.score = r.correct * 2 - r.wrong * 0.5;
    const att = r.correct + r.wrong;
    r.accuracy = att ? +(r.correct / att * 100).toFixed(1) : 0;
    total += r.score;
  }
  return { total: +total.toFixed(1), sections: rows };
}

/* --------------------------------- routes --------------------------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    if (path === "/" || path === "/api/health") {
      return json({ ok: true, bank: BANK.length, perSection: SECTIONS.map(s => ({ sec: s, count: BANK.filter(q => q.sec === s).length })) });
    }

    // Issue a paper. Questions only — never the key.
    if (path === "/api/paper" && request.method === "POST") {
      const claims = await verifyIdToken(bearer(request));
      if (!claims) return json({ error: "unauthenticated" }, 401);
      const uid = claims.sub;
      let seen = [];
      try { seen = JSON.parse(await env.EXAM.get("seen:" + uid) || "[]"); } catch {}
      const { picked, recycled } = drawPaper(seen);
      const ids = picked.map(q => q.id);
      const paperId = crypto.randomUUID();
      await env.EXAM.put("paper:" + paperId, JSON.stringify({ uid, ids, at: Date.now() }), { expirationTtl: 60 * 60 * 24 * 7 });
      const merged = Array.from(new Set([...(recycled.length ? [] : seen), ...ids]));
      await env.EXAM.put("seen:" + uid, JSON.stringify(merged));
      return json({ paperId, recycled, questions: picked.map(stripKey) });
    }

    // Score a submitted paper and hand back the key for review.
    if (path === "/api/submit" && request.method === "POST") {
      const claims = await verifyIdToken(bearer(request));
      if (!claims) return json({ error: "unauthenticated" }, 401);
      const body = await request.json().catch(() => ({}));
      const rec = JSON.parse(await env.EXAM.get("paper:" + body.paperId) || "null");
      if (!rec) return json({ error: "unknown paper" }, 404);
      if (rec.uid !== claims.sub) return json({ error: "not your paper" }, 403);
      const result = score(rec.ids, body.answers || {});
      const key = {};
      const byId = new Map(BANK.map(q => [String(q.id), q]));
      for (const id of rec.ids) { const q = byId.get(String(id)); if (q) key[q.id] = q.ans; }
      return json({ ...result, key });
    }

    // Examiner-only: the key for a specific set of questions, so the live
    // dashboard can mark answers right/wrong while the exam runs.
    if (path === "/api/key" && request.method === "POST") {
      const claims = await verifyIdToken(bearer(request));
      if (!claims) return json({ error: "unauthenticated" }, 401);
      if ((claims.email || "").toLowerCase() !== ADMIN_EMAIL) return json({ error: "forbidden" }, 403);
      const body = await request.json().catch(() => ({}));
      const want = Array.isArray(body.qids) ? body.qids : BANK.map(q => q.id);
      const byId = new Map(BANK.map(q => [String(q.id), q]));
      const key = {};
      for (const id of want) { const q = byId.get(String(id)); if (q) key[q.id] = q.ans; }
      return json({ key });
    }

    // Examiner-only: the full bank with answers, so the dashboard can render
    // any candidate's question and mark it right or wrong as they work.
    if (path === "/api/bank" && request.method === "POST") {
      const claims = await verifyIdToken(bearer(request));
      if (!claims) return json({ error: "unauthenticated" }, 401);
      if ((claims.email || "").toLowerCase() !== ADMIN_EMAIL) return json({ error: "forbidden" }, 403);
      return json({ questions: BANK });
    }

    return json({ error: "not found", path }, 404);
  }
};
