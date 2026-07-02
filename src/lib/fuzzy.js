// Tiny query→text closeness scoring for the search-suggestion dropdown.
// Returns 0..1: exact > prefix > word-prefix coverage > substring > bigram
// similarity, so "the closest thing to what was typed" floats to the top
// regardless of what kind of item it is.

function fold(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function bigrams(s) {
    const grams = new Map();
    for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        grams.set(g, (grams.get(g) || 0) + 1);
    }
    return grams;
}

// Dice coefficient over character bigrams — the order-tolerant fuzzy base.
function dice(a, b) {
    if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
    const ga = bigrams(a);
    const gb = bigrams(b);
    let overlap = 0;
    for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) || 0);
    return (2 * overlap) / (a.length - 1 + b.length - 1);
}

export function closeness(query, text) {
    const q = fold(query);
    const t = fold(text);
    if (!q || !t) return 0;
    if (q === t) return 1;

    let score = dice(q, t) * 0.6;

    // Typing is usually a prefix of what's wanted; reward that heavily (with a
    // slight preference for shorter, i.e. more completely-matched, titles).
    if (t.startsWith(q)) {
        score = Math.max(score, 0.92 - Math.min(0.12, (t.length - q.length) / 250));
    } else if (t.includes(q)) {
        score = Math.max(score, 0.72);
    }

    // Every query word prefix-matching some text word ("dua lip" → "Dua Lipa").
    const qWords = q.split(" ");
    const tWords = t.split(" ");
    const hits = qWords.filter((w) => tWords.some((tw) => tw.startsWith(w))).length;
    score = Math.max(score, (hits / qWords.length) * 0.82);

    return score;
}
