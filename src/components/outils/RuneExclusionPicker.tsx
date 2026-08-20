import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import MonsterAvatar from '../MonsterAvatar';
import { Champ, Flottant, Jeton } from '../../ui';
import Segmented from '../../ui/Segmented';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useNameFilteredResults } from '../../hooks/useNameFilteredResults';
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
  // Même monstre, par ESPÈCE cette fois — nécessaire pour garder RTA/siège
  // hors de la liste proposable aussi (la box seule ne suffit pas, voir
  // exclusionCandidatesFor).
  excludeOwnCom2usId: number | null;
  selected: ExclusionSelector[];
  onChange: (next: ExclusionSelector[]) => void;
  // ⚠️ Panneau « Options » mobile, resserré : texte/rembourrage réduits pour
  // que les 4 options tiennent sur UNE seule ligne malgré « Défenses siège »/
  // « Offenses siège » — voir Segmented.tsx, prop `dense`.
  denseSourceTabs?: boolean;
}

const SOURCE_OPTIONS: { key: ExclusionSource; label: string }[] = [
  { key: 'box', label: 'Box' },
  { key: 'rta', label: 'RTA' },
  { key: 'siege-defense', label: 'Défenses siège' },
  { key: 'siege-offense', label: 'Offenses siège' },
];

// Même étiquette que le comptage « Défense N »/« Offense N » déjà utilisé
// ailleurs (voir ownedBuilds.ts, SOURCE_LABEL) — recalculée ici plutôt que
// partagée (voir l'en-tête de optimizerExclusion.ts sur ce choix).
function sourceLabel(sel: ExclusionSelector, data: ExclusionSourceData): string {
  if (sel.source === 'box') return 'Box';
  if (sel.source === 'rta') return 'RTA';
  const teams = sel.source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
  const idx = teams.findIndex((t) => t.id === sel.teamId);
  const base = sel.source === 'siege-defense' ? 'Défenses siège' : 'Offenses siège';
  return idx === -1 ? base : `${base} · équipe ${idx + 1}`;
}

// Recherche + sélection multiple de monstres dont les runes ACTUELLES
// doivent être exclues de la recherche — 4 sources (box, RTA, siège
// défense/offense), une entrée précise par choix (pas juste un monstre :
// voir optimizerExclusion.ts). Même grammaire de navigation clavier que
// MonsterGearPicker (choix du monstre à optimiser).
export default function RuneExclusionPicker({ data, excludeOwnUnitKey, excludeOwnCom2usId, selected, onChange, denseSourceTabs = false }: Props) {
  const [activeSource, setActiveSource] = useState<ExclusionSource>('box');
  const [query, setQuery] = useState('');
  const idBase = useId();

  const selectedKeys = useMemo(() => new Set(selected.map(exclusionSelectorKey)), [selected]);

  const candidates = useMemo(
    () => exclusionCandidatesFor(activeSource, data, excludeOwnUnitKey, excludeOwnCom2usId),
    [activeSource, data, excludeOwnUnitKey, excludeOwnCom2usId]
  );

  const results = useNameFilteredResults(candidates, query);

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
      <Segmented
        options={SOURCE_OPTIONS}
        value={activeSource}
        onChange={setActiveSource}
        className="mb-2"
        size="lg"
        dense={denseSourceTabs}
      />

      <div className="relative">
        <Champ
          {...nav.inputProps}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un monstre à exclure…"
          icone={<Search className="h-4 w-4" />}
        />

        {/* ⚠️ Même pattern combobox que RtaSearch/MonsterGearPicker : Champ +
            Flottant, entrées sans rembourrage (elles touchent les bords). */}
        {nav.open && (
          <Flottant
            {...nav.listProps}
            aria-label="Résultats de la recherche"
            rembourrage="aucun"
            className="max-h-[300px] overflow-y-auto"
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
                    className={`flex w-full items-center gap-3 px-3 text-left transition
                      ${c.teamContext ? 'py-1' : 'py-1.5'}
                      ${dejaChoisi ? 'opacity-40 cursor-default' : 'cursor-pointer'}
                      ${estActif && !dejaChoisi ? 'bg-accent-soft' : ''}`}
                  >
                    <MonsterAvatar monster={c.monster} size={c.teamContext ? 46 : 28} className="flex-none" />
                    <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[13px] font-medium truncate flex-1">{c.monster.name}</span>
                        <span className="font-mono text-[11px] text-ink-dim flex-none">
                          {c.gear.runes.length} rune{c.gear.runes.length > 1 ? 's' : ''}
                        </span>
                        {dejaChoisi && <span className="text-[11px] text-ink-dim flex-none">déjà exclu</span>}
                      </div>
                      {/* ⚠️ Siège UNIQUEMENT — un même monstre peut apparaître
                          dans PLUSIEURS équipes, indiscernables par le seul nom
                          (deux « Tractor » d'équipes différentes) : le vrai
                          repère n'est PAS le portrait du monstre lui-même (même
                          espèce = même portrait dans les deux équipes), mais le
                          NUMÉRO d'équipe et SES COÉQUIPIERS — signalé
                          directement, à une échelle proche de celle de l'écran
                          Siège (pas de simples pastilles). ⚠️ `flex-wrap`, PAS
                          `overflow-x-auto` : un glissement horizontal dans un
                          panneau déjà scrollable verticalement est
                          quasi-inutilisable au doigt (les deux gestes se
                          concurrencent) — l'équipe entière doit rester visible
                          d'un coup, quitte à passer sur une deuxième ligne. */}
                      {c.teamContext && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-dim">
                          <span className="flex-none">Équipe {c.teamContext.teamNumber}</span>
                          <span className="flex flex-wrap items-center gap-2.5 min-w-0">
                            {c.teamContext.slots.map((m, slotIdx) => {
                              const estSlotCourant = 'slotIndex' in c.selector && c.selector.slotIndex === slotIdx;
                              return (
                                <span key={slotIdx} className="flex items-center gap-1.5 flex-none">
                                  <MonsterAvatar monster={m} element={false} size={34} className="flex-none" />
                                  <span className={`whitespace-nowrap ${estSlotCourant ? 'text-ink font-medium' : ''}`}>
                                    {m?.name ?? '—'}
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </Flottant>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selected.map((sel) => {
            const resolved = resolveExclusionEntry(sel, data);
            const key = exclusionSelectorKey(sel);
            return resolved ? (
              <Jeton
                key={key}
                icone={<MonsterAvatar monster={resolved.monster} size={18} />}
                libelle={resolved.monster.name}
                detail={`· ${sourceLabel(sel, data)}`}
                onRetirer={() => remove(sel)}
                libelleRetrait="Retirer cette exclusion"
              />
            ) : (
              <Jeton
                key={key}
                libelle={<span className="italic text-ink-dim">exclusion introuvable ({sourceLabel(sel, data)})</span>}
                onRetirer={() => remove(sel)}
                libelleRetrait="Retirer cette exclusion"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
