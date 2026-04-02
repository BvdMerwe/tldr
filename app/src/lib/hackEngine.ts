export interface Hack {
  domain: string; // e.g. "diploma.cy"
  prefix: string; // e.g. "diploma"
  tld: string;    // e.g. "cy"
  word: string;   // original word this came from
}

/**
 * Find all domain hacks for a word.
 * Tries every suffix split: for "magic" → tries tld="c","ic","gic","agic","magic".
 * Also tries multi-label hacks: "delicious" → "del.icio.us"
 */
export function findHacks(word: string, tldSet: Set<string>): Hack[] {
  const results: Hack[] = [];
  const seen = new Set<string>();
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 3) return results;

  // Single-split hacks
  for (let i = 1; i < w.length; i++) {
    const prefix = w.slice(0, i);
    const tld = w.slice(i);
    if (prefix.length < 2) continue;
    if (tldSet.has(tld)) {
      const domain = `${prefix}.${tld}`;
      if (!seen.has(domain)) {
        seen.add(domain);
        results.push({ domain, prefix, tld, word: w });
      }
    }
  }

  // Multi-label hacks (e.g. del.icio.us)
  for (let i = 2; i < w.length - 2; i++) {
    const outer = w.slice(i); // remaining after first split
    for (let j = 1; j < outer.length; j++) {
      const mid = outer.slice(0, j);
      const tld = outer.slice(j);
      if (mid.length < 2 || !tldSet.has(tld)) continue;
      const prefix = w.slice(0, i);
      if (prefix.length < 2) continue;
      const domain = `${prefix}.${mid}.${tld}`;
      if (!seen.has(domain)) {
        seen.add(domain);
        results.push({ domain, prefix: `${prefix}.${mid}`, tld, word: w });
      }
    }
  }

  return results;
}
