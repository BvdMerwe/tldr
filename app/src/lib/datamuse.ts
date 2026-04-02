export type RelationType = 'synonym' | 'trigger' | 'similar' | 'follower';

export interface WordResult {
  word: string;
  relation: RelationType;
  score: number;
}

interface DatamuseWord {
  word: string;
  score: number;
}

async function query(params: Record<string, string>, relation: RelationType, limit = 30): Promise<WordResult[]> {
  const qs = new URLSearchParams({ ...params, max: String(limit) });
  const res = await fetch(`https://api.datamuse.com/words?${qs}`);
  if (!res.ok) return [];
  const data: DatamuseWord[] = await res.json();
  return data.map(d => ({ word: d.word, relation, score: d.score }));
}

export async function getRelatedWords(input: string): Promise<WordResult[]> {
  const word = input.toLowerCase().trim();
  const [synonyms, triggers, similar] = await Promise.all([
    query({ rel_syn: word }, 'synonym'),
    query({ rel_trg: word }, 'trigger'),
    query({ ml: word }, 'similar'),
  ]);

  // Deduplicate by word, keeping highest score
  const map = new Map<string, WordResult>();
  for (const r of [...synonyms, ...triggers, ...similar]) {
    const w = r.word.toLowerCase().replace(/\s+/g, '');
    if (w === word || w.length < 3 || w.includes(' ')) continue;
    const existing = map.get(w);
    if (!existing || r.score > existing.score) map.set(w, { ...r, word: w });
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}
