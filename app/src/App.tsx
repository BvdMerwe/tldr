import { useState, useCallback, useEffect, useRef } from 'react';
import tldList from './data/tlds.json';
import corporateTldList from './data/corporateTlds.json';
import { findHacks, type Hack } from './lib/hackEngine';
import { getRelatedWords, type WordResult } from './lib/datamuse';
import { checkAvailability, type AvailabilityStatus } from './lib/availability';

function registrable(domain: string) {
  const parts = domain.split('.');
  return parts.slice(-2).join('.');
}

const CORPORATE_SET = new Set<string>(corporateTldList as string[]);
const TLD_SET = new Set<string>((tldList as string[]).filter(t => !CORPORATE_SET.has(t)));

const COMMON_TLDS = ['com', 'io', 'co', 'dev', 'app', 'ai', 'net', 'org'];

type RelationLabel = 'input' | 'synonym' | 'trigger' | 'similar' | 'combo';

interface ResultGroup {
  label: string;
  hacks: (Hack & { relation: RelationLabel })[];
}

function relationBadge(relation: RelationLabel) {
  const styles: Record<RelationLabel, string> = {
    input:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    synonym: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    trigger: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    similar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    combo:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const labels: Record<RelationLabel, string> = {
    input: 'exact', synonym: 'synonym', trigger: 'associated', similar: 'similar', combo: 'combo',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[relation]}`}>
      {labels[relation]}
    </span>
  );
}

function AvailabilityBadge({ domain }: { domain: string }) {
  const [status, setStatus] = useState<AvailabilityStatus>('checking');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setStatus('checking');
    checkAvailability(domain).then(s => {
      if (mounted.current) setStatus(s);
    });
    return () => { mounted.current = false; };
  }, [domain]);

  if (status === 'checking') {
    return <span className="text-xs text-gray-300 dark:text-gray-600 animate-pulse">checking…</span>;
  }
  const base = registrable(domain);
  const suffix = base !== domain ? ` (${base})` : '';

  if (status === 'available') {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
        available{suffix}
      </span>
    );
  }
  if (status === 'taken') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        taken{suffix}
      </span>
    );
  }
  return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
}

function Toggle({ enabled, onToggle, label, hint }: { enabled: boolean; onToggle: () => void; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-700'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {label} <span className="text-gray-400 dark:text-gray-600">({hint})</span>
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {copied ? 'copied!' : 'copy'}
    </button>
  );
}

function HackRow({ hack, showAvailability }: { hack: Hack & { relation: RelationLabel }; showAvailability: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
      <span className="font-mono text-base font-semibold text-gray-900 dark:text-gray-100">
        {hack.domain}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
        (from: {hack.word})
      </span>
      {relationBadge(hack.relation)}
      {showAvailability && <AvailabilityBadge domain={hack.domain} />}
      <CopyButton text={hack.domain} />
    </div>
  );
}

function Accordion({ group, showAvailability, defaultOpen = true }: {
  group: ResultGroup;
  showAvailability: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (group.hacks.length === 0) return null;
  return (
    <div className="mb-3 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {group.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-600">{group.hacks.length}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {group.hacks.map(h => (
            <HackRow key={h.domain} hack={h} showAvailability={showAvailability} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [searched, setSearched] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showCombos, setShowCombos] = useState(false);

  const generate = useCallback(async () => {
    const word = input.trim().toLowerCase();
    if (!word) return;
    setLoading(true);
    setSearched(true);
    setGroups([]);

    const inputHacks = findHacks(word, TLD_SET).map(h => ({
      ...h,
      relation: 'input' as RelationLabel,
    }));

    let related: WordResult[] = [];
    try {
      related = await getRelatedWords(word);
    } catch {
      // offline or rate-limited — show input hacks only
    }

    const relatedHacks: (Hack & { relation: RelationLabel })[] = [];
    for (const r of related.slice(0, 40)) {
      const hacks = findHacks(r.word, TLD_SET);
      for (const h of hacks) {
        relatedHacks.push({ ...h, relation: r.relation as RelationLabel });
      }
    }

    const seen = new Set(inputHacks.map(h => h.domain));
    const uniqueRelated = relatedHacks.filter(h => {
      if (seen.has(h.domain)) return false;
      seen.add(h.domain);
      return true;
    });

    const comboWords = [word, ...related.slice(0, 20).map(r => r.word)];
    const comboSeen = new Set<string>();
    const combos: (Hack & { relation: RelationLabel })[] = [];
    for (const w of comboWords) {
      for (const tld of COMMON_TLDS) {
        const domain = `${w}.${tld}`;
        if (!comboSeen.has(domain)) {
          comboSeen.add(domain);
          combos.push({ domain, prefix: w, tld, word: w, relation: 'combo' });
        }
      }
    }

    setGroups([
      { label: `Hacks on "${word}"`, hacks: inputHacks },
      { label: 'Hacks on related words', hacks: uniqueRelated },
      { label: 'Common TLD combos', hacks: combos },
    ]);
    setLoading(false);
  }, [input]);

  const hackCount = groups.slice(0, 2).reduce((n, g) => n + g.hacks.length, 0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
            domain<span className="text-violet-500">.hack</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Find clever domain names hidden inside real words
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="try: magic, deliver, instant..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          <button
            onClick={generate}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'Searching…' : 'Generate'}
          </button>
        </div>

        {/* Toggles */}
        {hackCount > 0 && !loading && (
          <div className="flex flex-col gap-2 mb-6 px-1">
            <Toggle
              enabled={showCombos}
              onToggle={() => setShowCombos(v => !v)}
              label="Show common TLD combos"
              hint=".com .io .co .dev .app .ai .net .org"
            />
            <Toggle
              enabled={showAvailability}
              onToggle={() => setShowAvailability(v => !v)}
              label="Check availability"
              hint="via RDAP — may be slow"
            />
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="text-center text-gray-400 text-sm py-12 animate-pulse">
            Finding domain hacks…
          </div>
        )}

        {!loading && searched && hackCount === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            No domain hacks found for <strong>"{input}"</strong> or its related words.
          </div>
        )}

        {!loading && hackCount > 0 && (
          <div>
            {groups.map((g, i) => (
              (g.label !== 'Common TLD combos' || showCombos) && (
                <Accordion
                  key={g.label}
                  group={g}
                  showAvailability={showAvailability}
                  defaultOpen={i < 2}
                />
              )
            ))}
          </div>
        )}

        {/* Examples shown before first search */}
        {!searched && (
          <div className="text-center text-sm text-gray-400 dark:text-gray-500">
            <p className="mb-3">Examples of domain hacks:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['diploma.cy', 'del.icio.us', 'instagr.am', 'youtu.be', 'bit.ly'].map(ex => (
                <span
                  key={ex}
                  className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-600 dark:text-gray-400"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
