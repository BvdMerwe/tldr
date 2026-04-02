# Domain Name Generator — Design Document

## Problem Statement

Given an input word, generate creative, pronounceable domain names built from
real English words and real TLDs. Two complementary techniques are used:

1. **Domain hacks** — the TLD is part of the word itself (`diploma.cy`, `del.icio.us`)
2. **Semantic combos** — related/synonym words paired with thematic TLDs (`swift.io`, `quick.ly`)

Word relations are powered by live word-graph APIs (synonyms, associations,
semantic neighbours). No availability checking — pure creative generation.

---

## Core Concepts

### Domain Hacks

A domain hack splits a word so that the TLD suffix completes the word:

```
"diplomacy"   → diploma  +  .cy   (Cyprus)
"deliver"     → deli     +  .ver  (not real — must match known TLD)
"magic"       → ma       +  .gi   (not real)  |  magi  +  .c  (not real)
"instagram"   → instagr  +  .am   (Armenia)
"delicious"   → del.icio +  .us   (United States)
```

The algorithm:

1. For each word, iterate every possible suffix split.
2. Check if the suffix (lowercased, no leading dot) exists in the TLD list.
3. Optionally recurse on the prefix for multi-label hacks (`del.icio.us`).
4. Score results by TLD popularity / length of real-word prefix.

### Semantic Word Expansion

Given input word `W`, fetch related words from the Datamuse API:

| Relation type     | Datamuse endpoint          | Example (input: "magic")         |
|-------------------|----------------------------|----------------------------------|
| Synonyms          | `?rel_syn=W`               | sorcery, enchantment, spell      |
| Triggers (assoc.) | `?rel_trg=W`               | wand, hat, rabbit, trick         |
| Frequent followers| `?rel_bga=W`               | show, trick, carpet              |
| Frequent leaders  | `?rel_bgb=W`               | black, stage                     |
| Sounds like       | `?sl=W`                    | (morphological variants)         |
| Means like        | `?ml=W`                    | illusion, conjuring              |

All returned words are fed through the same domain hack algorithm, producing a
rich pool of suggestions from the word's semantic neighbourhood.

---

## TLD Data

Source: **IANA Root Zone Database** — `https://data.iana.org/TLD/tlds-alpha-by-domain.txt`

- ~1,500 TLDs including ccTLDs (`.cy`, `.us`, `.am`) and gTLDs (`.dev`, `.io`, `.ly`)
- Bundled as a static JSON file at build time (< 30 KB)
- Annotated with a "popularity score" so common TLDs rank higher in results

---

## Three Solution Architectures

---

### Solution A — Pure Browser SPA (No Backend)

```
Browser
  └─ React SPA
       ├─ bundled TLD list (JSON, ~30 KB)
       ├─ domain hack engine (pure JS)
       └─ Datamuse API calls (CORS-friendly, free, no key)
```

**Flow:**
```
user types word
  → fetch related words from Datamuse (synonyms + triggers + ml)
  → run hack algorithm over [input] + related words
  → rank & deduplicate results
  → display grouped list
```

**Pros:** Zero infra, instant deploy (GitHub Pages / Vercel), no rate-limit
concerns at small scale, fully offline after first load if TLD list is cached.

**Cons:** Datamuse is the only word-graph source; no true semantic vector
similarity; API calls go directly from user browser.

---

### Solution B — Browser + Edge Function (Recommended)

```
Browser                           Edge Function (Vercel/CF Worker)
  └─ React SPA          ←──────→  /api/suggest?word=magic
       └─ bundled TLD list              ├─ Datamuse (synonyms, triggers, ml)
       └─ domain hack engine            ├─ WordsAPI or ConceptNet (associations)
                                        └─ deduplicated, scored JSON response
```

**Flow:**
```
user types word
  → SPA calls /api/suggest?word=W
  → edge fn fans out to Datamuse + optional secondary APIs
  → merges, scores, deduplicates word candidates
  → SPA runs domain hack engine on candidates (TLD list is client-side)
  → display results
```

**Pros:** Can add/swap word APIs without redeploying frontend; edge fn adds
caching (`Cache-Control`) so repeat queries are instant; keeps API keys
server-side if needed later.

**Cons:** Requires a serverless function host; slightly more moving parts than
Solution A.

---

### Solution C — Browser + GloVe Embeddings (Offline Semantic)

```
Browser
  └─ React SPA
       ├─ bundled TLD list (JSON, ~30 KB)
       ├─ pruned GloVe vectors (top-10k words, 50d → ~4 MB gzipped ~1.8 MB)
       ├─ cosine similarity k-NN search (pure JS)
       └─ domain hack engine
```

**Flow:**
```
user types word
  → look up word vector in GloVe index
  → find top-N nearest neighbours (cosine similarity)
  → run hack algorithm over input + neighbours
  → display results (fully offline after initial bundle load)
```

**Pros:** True semantic similarity (not just thesaurus); works offline; no
external API dependencies or rate limits.

**Cons:** Large bundle (~2 MB extra); slower first load; only covers words in
the GloVe vocabulary (no proper nouns / niche terms).

---

## Recommended Approach: Solution B

Solution B gives the best balance of word-relation quality, maintainability,
and deploy simplicity. The edge function can start with just Datamuse (free,
no key) and be upgraded later without touching the frontend.

---

## UI Design

```
┌─────────────────────────────────────────────────────┐
│  domain.wtf                                  [dark]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│    Find clever domain names for any word             │
│                                                      │
│    ┌───────────────────────────────┐  [Generate]     │
│    │  magic                        │                 │
│    └───────────────────────────────┘                 │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Hacks on "magic"                                    │
│  ─────────────────                                   │
│  ● ma.gi.c    (not found)                            │
│  ● magi.c     (.c — Cocos Islands)                   │
│                                                      │
│  Hacks on related words                              │
│  ──────────────────────                              │
│  ● spel.ls    (.ls — Lesotho)      [synonym]         │
│  ● trick.er   (.er — not found)                      │
│  ● illu.si.on (.si — Slovenia?)    [semantic]        │
│  ● conjure.rs (.rs — Serbia)       [trigger]         │
│  ● wiza.rd    (.rd — not found)                      │
│  ● sorcery.   —                                      │
│                                                      │
│  Semantic combos                                     │
│  ───────────────                                     │
│  ● magic.al   —                                      │
│  ● spell.io   (.io — popular tech TLD)  [combo]      │
│  ● enchant.me (.me — Montenegro)        [combo]      │
│  ● illusion.ist (.ist — Istanbul?)      [combo]      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Interaction Details

- **Input:** Single text field, generates on Enter or button click
- **Results grouped by:** Hacks on input | Hacks on related words | Semantic combos
- **Each result shows:** `word.tld` | TLD country/meaning | relation type badge
- **Scoring/ranking:** TLD popularity × prefix word length × relation closeness
- **Copy button** on each result for quick clipboard copy
- **Filter chips:** synonyms | triggers | associations | all

---

## Implementation Plan

### Phase 1 — Core hack engine
- [ ] Fetch and bundle IANA TLD list as `src/data/tlds.json`
- [ ] Implement `findHacks(word: string, tlds: Set<string>): Hack[]`
- [ ] Unit test hack algorithm against known examples (`diploma.cy`, `del.icio.us`)

### Phase 2 — Word expansion
- [ ] Datamuse API client (`src/lib/datamuse.ts`)
- [ ] Edge function `/api/suggest` that fans out to Datamuse endpoints
- [ ] Combine & deduplicate candidate words with relation metadata

### Phase 3 — UI
- [ ] React SPA scaffold (Vite + TypeScript)
- [ ] Search input + results list components
- [ ] Grouped result cards with relation badges
- [ ] Copy-to-clipboard per result

### Phase 4 — Polish
- [ ] Scoring & ranking algorithm
- [ ] Filter chips by relation type
- [ ] Dark/light mode
- [ ] Loading skeletons
- [ ] Deploy to Vercel

---

## Tech Stack

| Layer        | Choice                     | Reason                              |
|--------------|----------------------------|-------------------------------------|
| Frontend     | React + Vite + TypeScript  | Fast dev, small bundle              |
| Styling      | Tailwind CSS               | Utility-first, no design system dep |
| Word API     | Datamuse (free, no key)    | Synonyms, triggers, ml, CORS-ok     |
| Edge fn      | Vercel Functions           | Co-located with frontend            |
| TLD data     | IANA root zone list        | Authoritative, ~1500 entries        |
| Deploy       | Vercel                     | Free tier, edge functions included  |

---

## Open Questions

- Should results link to a registrar (Namecheap, Porkbun) for one-click purchase?
- Should multi-label hacks (`del.icio.us` style) be shown separately or grouped?
- Max number of related words to fetch per query (suggest: 30–50 per relation type)?
