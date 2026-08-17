import { useId, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import MonsterAvatar from '../MonsterAvatar';
import Segmented from '../Segmented';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import {
  ExclusionCandidate,
  ExclusionSelector,
  ExclusionSource,
  ExclusionSourceData,
  exclusionCandidatesFor,
  exclusionSelectorKey,
  resolveExclusionEntry,
} from '../../lib/optimizerExclusion';

interface Props {
  data: ExclusionSourceData;
  // Le monstre actuellement recherché — jamais proposable à l'exclusion
  // depuis sa propre entrée box (voir optimizerExclusion.ts).
  excludeOwnUnitKey: string | null;
  selected: ExclusionSelector[];
  onChange: (next: ExclusionSelector[]) => void;
}

const MAX_RESULTS = 25;

const SOURCE_OPTIONS: { key: ExclusionSource; label: string }[] = [
  { key: 'box', label: 'Box' },
  { key: 'rta', label: 'RTA' },
  { key: 'siege-defense', label: 'Siège défense' },
  { key: 'siege-offense', label: 'Siège offense' },
];

// Même étiquette que le comptage « Défense N »/« Offense N » déjà utilisé
// ailleurs (voir ownedBuilds.ts, SOURCE_LABEL) — recalculée ici plutôt que
// partagée (voir l'en-tête de optimizerExclusion.ts sur ce choix).
function sourceLabel(sel: ExclusionSelector, data: ExclusionSourceData): string {
  if (sel.source === 'box') return 'Box';
  if (sel.source === 'rta') return 'RTA';
  const teams = sel.source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
  const idx = teams.findIndex((t) => t.id === sel.teamId);
  const base = sel.source === 'siege-defense' ? 'Siège défense' : 'Siège offense';
  return idx === -1 ? base : `${base} · équipe ${idx + 1}`;
}

// Recherche + sélection multiple de monstres dont les runes ACTUELLES
// doivent être exclues de la recherche — 4 sources (box, RTA, siège
// défense/attaque), une entrée précise par choix (pas juste un monstre :
// voir optimizerExclusion.ts). Même grammaire de navigation clavier que
// MonsterGearPicker (choix du monstre à optimiser).
export default function RuneExclusionPicker({ data, excludeOwnUnitKey, selected, onChange }: Props) {
  const [activeSource, setActiveSource] = useState<ExclusionSource>('box');
  const [query, setQuery] = useState('');
  const idBase = useId();

  const selectedKeys = useMemo(() => new Set(selected.map(exclusionSelectorKey)), [selected]);

  const candidates = useMemo(
    () => exclusionCandidatesFor(activeSource, data, excludeOwnUnitKey),
    [activeSource, data, excludeOwnUnitKey]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: ExclusionCandidate[] = [];
    for (const c of candidates) {
      if (c.monster.name.toLowerCase().includes(q)) {
        out.push(c);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [candidates, query]);

  function add(candidate: ExclusionCandidate) {
    const key = exclusionSelectorKey(candidate.selector);
    if (selectedKeys.has(key)) return;
    onChange([...selected, candidate.selector]);
  }
  function remove(sel: ExclusionSelector) {
    const key = exclusionSelectorKey(sel);
    onChange(selected.filter((s) => exclusionSelectorKey(s) !== key));
  }

  const nav = useComboboxNav<ExclusionCandidate>({
    results,
    query,
    setQuery,
    idBase,
    estDesactive: (c) => selectedKeys.has(exclusionSelectorKey(c.selector)),
    onValider: add,
  });

  return (
    <div>
      <Segmented options={SOURCE_OPTIONS} value={activeSource} onChange={setActiveSource} className="mb-2 flex-wrap" />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-dim" />
        <input
          {...nav.inputProps}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un monstre à exclure…"
          className="w-full bg-panel border border-border rounded-lg py-2 pl-9 pr-3 text-[13px]
                     text-ink placeholder:text-ink-dim outline-none transition
                     focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.25)]"
        />

        {nav.open && (
          <div
            {...nav.listProps}
            aria-label="Résultats de la recherche"
            className="absolute z-30 mt-1.5 w-full max-h-[300px] overflow-y-auto rounded-lg border border-border bg-panel shadow-glow shadow-black/60"
          >
            {results.length === 0 ? (
              <div className="px-3 py-2 text-ink-dim text-[12.5px]">
                {candidates.length === 0 ? 'Aucun monstre équipé de runes dans cette source.' : 'Aucun monstre trouvé.'}
              </div>
            ) : (
              results.map((c, i) => {
                const estActif = i === nav.actif;
                const dejaChoisi = selectedKeys.has(exclusionSelectorKey(c.selector));
                return (
                  <div
                    key={exclusionSelectorKey(c.selector)}
                    {...nav.optionProps(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (dejaChoisi) return;
                      add(c);
                      nav.reinitialiser();
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition
                      ${dejaChoisi ? 'opacity-40 cursor-default' : 'cursor-pointer'}
                      ${estActif && !dejaChoisi ? 'bg-accent-soft' : ''}`}
                  >
                    <MonsterAvatar monster={c.monster} size={28} />
                    <span className="text-[13px] font-medium truncate flex-1">{c.monster.name}</span>
                    <span className="font-mono text-[11px] text-ink-dim">
                      {c.gear.runes.length} rune{c.gear.runes.length > 1 ? 's' : ''}
                    </span>
                    {dejaChoisi && <span className="text-[11px] text-ink-dim">déjà exclu</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selected.map((sel) => {
            const resolved = resolveExclusionEntry(sel, data);
            const key = exclusionSelectorKey(sel);
            return (
              <span
                key={key}
                className="flex items-center gap-1.5 rounded-full border border-border bg-panel2 pl-1 pr-1.5 py-0.5 text-[12px] text-ink"
              >
                {resolved ? (
                  <>
                    <MonsterAvatar monster={resolved.monster} size={18} />
                    <span className="font-medium">{resolved.monster.name}</span>
                    <span className="text-ink-dim">· {sourceLabel(sel, data)}</span>
                  </>
                ) : (
                  <span className="text-ink-dim italic">exclusion introuvable ({sourceLabel(sel, data)})</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(sel)}
                  title="Retirer cette exclusion"
                  className="ml-0.5 text-ink-dim hoverable:text-ink"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
