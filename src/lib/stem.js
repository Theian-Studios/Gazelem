// Reducing a word to its stem is what lets one search find every form of a
// word: "atonement", "atone", "atones" and "atoning" all come back as `atone`,
// so any of them finds the others.
//
// This is the Porter stemmer (M.F. Porter, 1980), the standard light stemmer
// for English, plus the archaic verb endings the King James text is full of —
// "sayest", "doeth" — which Porter predates the need for.
//
// The same stemming has to happen when the index is built and when a query is
// read, or the two would never meet; both sides import this file.

const c = "[^aeiou]";
const v = "[aeiouy]";
const C = c + "[^aeiouy]*";
const V = v + "[aeiou]*";

// Porter's measure m: the number of vowel-consonant sequences in a stem, which
// stands in for "is this word long enough to take the ending off".
const mGt0 = new RegExp("^(" + C + ")?" + V + C);
const mEq1 = new RegExp("^(" + C + ")?" + V + C + "(" + V + ")?$");
const mGt1 = new RegExp("^(" + C + ")?" + V + C + V + C);
const hasVowel = new RegExp("^(" + C + ")?" + v);

const doubleC = /([^aeiouylsz])\1$/;
// A short word ending consonant-vowel-consonant, where the last is not w, x or
// y — the shape that wants its silent "e" put back.
const cvc = new RegExp("^" + C + v + "[^aeiouwxy]$");

// Nouns long enough to pass the measure test below but no more verbs than
// "harvest" is: without this they lose an ending they never had.
const NOT_A_VERB = new Set([
  "harvest", "manifest", "tempest", "request", "forest", "honest", "earnest",
  "arrest", "protest", "contest", "conquest", "modest", "behest",
]);

const STEP2 = {
  ational: "ate", tional: "tion", enci: "ence", anci: "ance", izer: "ize",
  bli: "ble", alli: "al", entli: "ent", eli: "e", ousli: "ous",
  ization: "ize", ation: "ate", ator: "ate", alism: "al", iveness: "ive",
  fulness: "ful", ousness: "ous", aliti: "al", iviti: "ive", biliti: "ble",
  logi: "log",
};
const STEP3 = {
  icate: "ic", ative: "", alize: "al", iciti: "ic", ical: "ic", ful: "", ness: "",
};
const STEP4 = [
  "al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement", "ment",
  "ent", "ion", "ou", "ism", "ate", "iti", "ous", "ive", "ize",
];

// Puts back what an ending swallowed when it was taken off: "atoning" → "aton"
// → "atone", "sitting" → "sitt" → "sit".
function restore(w) {
  if (/(at|bl|iz)$/.test(w)) return w + "e";
  if (doubleC.test(w)) return w.slice(0, -1);
  if (mEq1.test(w) && cvc.test(w)) return w + "e";
  return w;
}

export function stem(word) {
  let w = word;
  if (w.length < 3) return w;

  // Step 1a — plurals. The -us guard is not Porter's: without it the s of
  // "righteous" comes off as though it were one, and the word no longer meets
  // "righteousness", which keeps its s behind the -ness.
  if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("ies")) w = w.slice(0, -2);
  else if (w.endsWith("ss") || w.endsWith("us")) { /* keep */ }
  else if (w.endsWith("s")) w = w.slice(0, -1);

  // The King James verb endings, before Porter's own past-tense rules: -est
  // and -eth are the second and third person ("sayest", "doeth"), and -edst
  // both at once ("calledst"). Porter's measure test throws out the short
  // words that only look like verbs — "teeth", "west" — and the list above
  // covers the longer nouns it would otherwise take an ending off.
  if (!NOT_A_VERB.has(w)) {
    for (const suffix of ["edst", "eth", "est"]) {
      if (w.endsWith(suffix)) {
        const base = w.slice(0, -suffix.length);
        // Same silent-e restoration Porter does after -ed and -ing, or
        // "cometh" would stem to `com` while "come" stayed whole.
        if (mGt0.test(base)) { w = restore(base); break; }
      }
    }
  }

  // Step 1b — past tense and participles.
  if (w.endsWith("eed")) {
    if (mGt0.test(w.slice(0, -3))) w = w.slice(0, -1);
  } else {
    const cut = w.endsWith("ed") ? 2 : w.endsWith("ing") ? 3 : 0;
    if (cut && hasVowel.test(w.slice(0, -cut))) w = restore(w.slice(0, -cut));
  }

  // Step 1c — a trailing y becomes i, so "mercy" and "merciful" meet.
  if (w.endsWith("y") && hasVowel.test(w.slice(0, -1))) w = w.slice(0, -1) + "i";

  // Steps 2 and 3 — derivational endings, longest match first.
  for (const [from, to] of Object.entries(STEP2)) {
    if (w.endsWith(from) && mGt0.test(w.slice(0, -from.length))) { w = w.slice(0, -from.length) + to; break; }
  }
  for (const [from, to] of Object.entries(STEP3)) {
    if (w.endsWith(from) && mGt0.test(w.slice(0, -from.length))) { w = w.slice(0, -from.length) + to; break; }
  }

  // Step 4 — the endings only a long word can spare: "atonement" → "atone".
  for (const suffix of STEP4) {
    if (!w.endsWith(suffix)) continue;
    const base = w.slice(0, -suffix.length);
    // "ion" only comes off after s or t ("transgression", "salvation").
    if (suffix === "ion" && !/[st]$/.test(base)) continue;
    if (mGt1.test(base)) { w = base; break; }
  }

  // Step 5 — the silent e, and a doubled l.
  if (w.endsWith("e")) {
    const base = w.slice(0, -1);
    if (mGt1.test(base) || (mEq1.test(base) && !cvc.test(base))) w = base;
  }
  if (w.endsWith("ll") && mGt1.test(w)) w = w.slice(0, -1);

  return w;
}

// Words as the index counts them: lowercase runs of letters, with the
// apostrophes of "hearken'd" and "Lord's" folded away rather than splitting a
// word in two.
export function words(text) {
  return text.toLowerCase().replace(/[’']/g, "").match(/[a-z]+/g) || [];
}

export const stems = (text) => words(text).map(stem);
