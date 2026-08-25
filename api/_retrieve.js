import BOOK from "./_book.js";

/**
 * Keyword retrieval over the manuscript.
 *
 * The book is ~75K tokens. Sending all of it on every question would cost
 * roughly 40c a go, so instead we pull the handful of passages that actually
 * bear on the question and send those. Built once per cold start, then reused.
 */

const STOP = new Set(
  ("a an and are as at be been but by can did do does for from had has have how i if in into is it " +
   "its me more most no nor not of on or our so than that the their them then there these they this " +
   "to too was we were what when where which who whom why will with would you your about" ).split(" ")
);

const norm = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

const terms = (s) => norm(s).filter((w) => w.length > 2 && !STOP.has(w));

// --- index, built once ---
const DOCS = BOOK.map((p) => {
  const tf = new Map();
  for (const w of terms(p.s.replace(/_/g, " ") + " " + p.t)) {
    tf.set(w, (tf.get(w) || 0) + 1);
  }
  return { section: p.s, text: p.t, tf, len: Math.sqrt(tf.size || 1) };
});

const DF = new Map();
for (const d of DOCS) for (const w of d.tf.keys()) DF.set(w, (DF.get(w) || 0) + 1);
const N = DOCS.length;

/** Returns the passages most relevant to `question`, best first. */
export function retrieve(question, limit = 8) {
  const q = terms(question);
  if (!q.length) return [];

  const scored = DOCS.map((d) => {
    let score = 0;
    for (const w of q) {
      const tf = d.tf.get(w);
      if (!tf) continue;
      const idf = Math.log(1 + N / (DF.get(w) || 1));
      score += idf * (1 + Math.log(tf));
    }
    return { d, score: score / d.len };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d);
}

/** The retrieved passages, formatted for the system prompt. */
export function asContext(passages) {
  if (!passages.length) return "";
  return passages
    .map((p) => `[${p.section.replace(/_/g, " ")}]\n${p.text}`)
    .join("\n\n---\n\n");
}

export const PASSAGE_COUNT = DOCS.length;
