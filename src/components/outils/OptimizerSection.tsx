import { useMemo, useState } from 'react';
import { Search, Boxes, Loader2, Square, Settings2 } from 'lucide-react';
import { RECO_STATS, RuneDetail } from '../../types';
import { BoxItem } from '../../lib/applyAccount';
import { computeStats, StatRow } from '../../lib/stats';
import { RUNE_EFFECT, StatKey, runeEfficiency } from '../../lib/effects';
import { BuildRequirement, SLOT_MAIN_OPTIONS, excludedRuneIds } from '../../lib/runeBuildOptim';
import { useBuildOptimSearch } from '../../hooks/useBuildOptimSearch';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import NumberField from '../NumberField';
import MonsterAvatar from '../MonsterAvatar';
import Segmented from '../Segmented';
import MonsterGearPicker, { GearedMonster } from './MonsterGearPicker';
import SetComboPicker from './SetComboPicker';
import BuildCandidateCard from './BuildCandidateCard';
import StatTable from './StatTable';

interface Props {
  box: BoxItem[];
  runes: RuneDetail[];
}

// Taux Crit, RES et Précision sont plafonnés à 100 % **dans le jeu** (leur
// effet ne va jamais au-delà, même si la somme brute des runes dépasse). Dmg
// Crit n'a pas ce plafond (200 %+ courant). ⚠️ Le plafond ne s'applique QU'À
// la saisie d'une condition (minimum ou maximum) : la RECHERCHE, elle, ne
// doit surtout pas exclure un build dont la somme brute dépasse 100 % — c'est
// un résultat légitime, seule la demande d'un seuil > 100 % n'a pas de sens.
const CAPPED_100 = new Set<StatKey>(['cr', 'res', 'acc']);

const CONFIGURABLE_SLOTS: (2 | 4 | 6)[] = [2, 4, 6];

// Objectifs composites : combinent plusieurs stats en un seul critère de tri,
// en plus des 8 stats brutes et de l'efficience déjà proposées.
type Objective = 'degats-assure' | 'degats-non-crit' | 'degats-moyenne' | 'ehp';
type SortKey = StatKey | 'eff' | Objective;

function statTotal(stats: StatRow[], key: StatKey): number {
  return stats.find((s) => s.key === key)?.total ?? 0;
}

// Dégâts espérés — trois hypothèses de coup critique, au choix (aucune n'est
// « la » bonne réponse : ça dépend du monstre et du contexte de jeu visé).
//  - assuré  : le coup critique est garanti (TC effectif = 100 %).
//  - non-crit: le coup critique n'arrive jamais (TC effectif = 0 %).
//  - moyenne : espérance sur le taux de critique réellement atteint.
function objectiveScore(stats: StatRow[], objective: Objective): number {
  const atk = statTotal(stats, 'atk');
  if (objective === 'degats-assure') return atk * (1 + statTotal(stats, 'cd') / 100);
  if (objective === 'degats-non-crit') return atk;
  if (objective === 'degats-moyenne') {
    return atk * (1 + (statTotal(stats, 'cr') / 100) * (statTotal(stats, 'cd') / 100));
  }
  // PV effectifs : réutilise le facteur de défense déjà documenté dans
  // spec/mecaniques.md (1000 / (1140 + 3,5 × DEF)), pas une formule maison.
  const hp = statTotal(stats, 'hp');
  const def = statTotal(stats, 'def');
  return (hp * (1140 + 3.5 * def)) / 1000;
}

const OBJECTIVE_LABELS: { key: Objective; label: string }[] = [
  { key: 'degats-assure', label: 'Dégâts (coup critique assuré)' },
  { key: 'degats-non-crit', label: 'Dégâts (non critique)' },
  { key: 'degats-moyenne', label: 'Dégâts (moyenne)' },
  { key: 'ehp', label: 'PV effectifs' },
];

// Outil « Optimizer » : cherche, parmi les runes du compte, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre, un combo de sets et des
// minimums de stats donnés. Voir spec/outils/optimizer.md.
export default function OptimizerSection({ box, runes }: Props) {
  const metric = useRuneMetric();

  // TOUS les monstres 6★ de la box importée (avec ou sans runes actuellement
  // équipées — voir « Mon compte » → Monstres), dédupliqués par monstre : on
  // garde le meilleur exemplaire équipé pour les stats/artéfacts affichés —
  // voir spec/outils/optimizer.md pour cette simplification.
  const gearedMonsters = useMemo<GearedMonster[]>(() => {
    const best = new Map<string, BoxItem>();
    const score = (b: BoxItem) => (b.gear?.runes ?? []).reduce((s, r) => s + runeEfficiency(r), 0);
    for (const item of box) {
      if (!item.gear) continue;
      const id = String(item.monster.id);
      const prev = best.get(id);
      if (!prev || score(item) > score(prev)) best.set(id, item);
    }
    return Array.from(best.values()).map((item) => ({ monster: item.monster, gear: item.gear! }));
  }, [box]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = gearedMonsters.find((g) => String(g.monster.id) === selectedId) ?? null;

  const [comboSets, setComboSets] = useState<string[]>([]);
  // ⚠️ Stocké en TOTAL, toujours — c'est ce qu'attend le moteur de recherche
  // (comme RecoSlot.stats). Le mode « Bonus » n'est qu'une LECTURE dérivée
  // (valeur − base du monstre choisi) : le champ affiché change avec le mode
  // ou le monstre, mais la contrainte réellement posée ne bouge jamais sous
  // le pied de l'utilisateur.
  const [minStats, setMinStats] = useState<Partial<Record<StatKey, number>>>({});
  const [maxStats, setMaxStats] = useState<Partial<Record<StatKey, number>>>({});
  const [statMode, setStatMode] = useState<'bonus' | 'total'>('total');
  // Statistiques principales autorisées sur les slots 2/4/6 — vide = libre.
  // Voir spec/outils/optimizer.md : pour un Lushen, ATQ% en 2, Dmg Crit en 4,
  // ATQ% en 6 — sans cette contrainte, ces slots partent dans n'importe quel
  // sens et noient le pré-filtrage sous des runes hors sujet.
  const [mainStatsBySlot, setMainStatsBySlot] = useState<Partial<Record<2 | 4 | 6, number[]>>>({});
  const [exploreAll, setExploreAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('eff');

  function toggleMainStat(slot: 2 | 4 | 6, code: number) {
    setMainStatsBySlot((prev) => {
      const cur = prev[slot] ?? [];
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...prev, [slot]: next };
    });
  }

  // ⚠️ Réglages avancés, volontairement PAS masqués derrière une valeur
  // magique choisie une fois pour toutes : sur un gros compte (des centaines
  // de runes par slot), le plafond de pré-filtrage par défaut peut écarter
  // des runes qui compteraient — voir spec/outils/optimizer.md. Les élargir
  // aide, mais a un coût réel (mémoire ET temps, pas seulement temps) : le
  // moteur matérialise tous les combos d'une moitié d'un coup, donc un
  // plafond trop haut peut faire planter l'onglet plutôt que juste ralentir.
  // D'où l'avertissement affiché, pas un simple curseur libre.
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxSeconds, setMaxSeconds] = useState<number | null>(15);
  const [slotFilterCap, setSlotFilterCap] = useState<number | null>(null);

  const { status, result, run, stop } = useBuildOptimSearch();
  // Distingue « arrêtée par l'utilisateur » de « tronquée par un plafond » :
  // le message affiché (voir plus bas) n'a pas à dire « resserre tes
  // critères » quand c'est un choix délibéré, pas une limite subie.
  const [stoppedManually, setStoppedManually] = useState(false);

  const runeById = useMemo(() => new Map(runes.map((r) => [r.id, r])), [runes]);

  function handleSearch() {
    if (!selected) return;
    setStoppedManually(false);
    // ⚠️ Exclusion par défaut : ne propose que des combos réellement montables
    // sans dérunir un autre monstre de la box. « Explorer tout l'inventaire »
    // lève la contrainte. Voir spec/outils/optimizer.md.
    const excluded = exploreAll
      ? new Set<number>()
      : excludedRuneIds(
          box.map((b) => ({ unitKey: b.key, com2usId: b.monster.com2usId, gear: b.gear })),
          selected.monster.com2usId
        );
    const pool = excluded.size === 0 ? runes : runes.filter((r) => !excluded.has(r.id));
    // Slots sans aucune stat cochée → pas de contrainte transmise (un tableau
    // vide se lirait comme « aucune stat principale possible », ce qui
    // écarterait tout le slot au lieu de le laisser libre).
    const mainStats: BuildRequirement['mainStats'] = {};
    for (const slot of CONFIGURABLE_SLOTS) {
      const codes = mainStatsBySlot[slot];
      if (codes && codes.length > 0) mainStats[slot] = codes;
    }
    const requirement: BuildRequirement = { sets: comboSets, minStats, maxStats, mainStats };
    run({
      base: selected.gear.base,
      artifacts: selected.gear.artifacts,
      relic: selected.gear.relic,
      pool,
      requirement,
      metric,
      // `null` (champ vidé) → pas de limite automatique, le bouton Arrêter
      // reste le seul recours. ⚠️ `Infinity`, pas `undefined` : le moteur
      // retombe sur son défaut (15 s) via `??` si on lui passe `undefined`.
      // `Infinity` se transmet très bien par `postMessage` (structured
      // clone), contrairement à `JSON.stringify` qui l'aurait perdu.
      maxMs: maxSeconds == null ? Infinity : maxSeconds * 1000,
      ...(slotFilterCap != null ? { slotFilterCap } : {}),
    });
  }

  // Tri CLIENT, sans relancer la recherche : le moteur collecte déjà les
  // stats complètes de chaque candidat valide (voir runeBuildOptim.ts).
  const sortedCandidates = useMemo(() => {
    if (!result) return [];
    const list = result.candidates.slice();
    if (sortBy === 'eff') {
      list.sort((a, b) => b.effTotal - a.effTotal);
    } else if (sortBy === 'degats-assure' || sortBy === 'degats-non-crit' || sortBy === 'degats-moyenne' || sortBy === 'ehp') {
      list.sort((a, b) => objectiveScore(b.stats, sortBy) - objectiveScore(a.stats, sortBy));
    } else {
      list.sort((a, b) => statTotal(b.stats, sortBy) - statTotal(a.stats, sortBy));
    }
    return list.slice(0, 20);
  }, [result, sortBy]);

  const currentStats = selected ? computeStats(selected.gear) : null;

  // Base « nue » du monstre choisi pour une stat — 0 tant qu'aucun monstre
  // n'est sélectionné (le mode « Bonus » coïncide alors avec « Total »).
  function baseOf(key: StatKey): number {
    return selected ? (selected.gear.base as unknown as Record<StatKey, number>)[key] : 0;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-[13px] text-ink-dim">
        Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement
        indicatif — c'est à toi de re-runer dans le jeu.
      </p>

      <div>
        <p className="label mb-1.5">Monstre à optimiser</p>
        <MonsterGearPicker items={gearedMonsters} onPick={setSelectedId} />
      </div>

      {selected && currentStats && (
        <div className="rounded-xl border border-border bg-panel p-3">
          <div className="flex items-center gap-2 mb-2">
            <MonsterAvatar monster={selected.monster} size={32} />
            <span className="font-semibold text-[14px]">{selected.monster.name}</span>
          </div>
          <p className="label mb-1.5">Stats actuelles</p>
          <StatTable stats={currentStats} />
        </div>
      )}

      <div>
        <p className="label mb-1.5">Set de runes recherché</p>
        <SetComboPicker sets={comboSets} onChange={setComboSets} />
      </div>

      <div>
        <p className="label mb-1.5">Statistique principale imposée (slots pairs)</p>
        <div className="flex flex-col gap-1.5">
          {CONFIGURABLE_SLOTS.map((slot) => (
            <div key={slot} className="flex items-center gap-2 flex-wrap">
              <span className="text-[11.5px] text-ink-dim w-14">Slot {slot}</span>
              {SLOT_MAIN_OPTIONS[slot].map((code) => {
                const active = (mainStatsBySlot[slot] ?? []).includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleMainStat(slot, code)}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition select-none ${
                      active
                        ? 'border-accent bg-accent-soft text-ink shadow'
                        : 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
                    }`}
                  >
                    {RUNE_EFFECT[code]?.label ?? code}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-ink-dim">
          Aucune coche sur un slot = pas de contrainte. Pour un Lushen classique par exemple : ATQ%
          en 2, Dmg Crit en 4, ATQ% en 6.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="label">Conditions</p>
          <Segmented
            options={[
              {
                key: 'total',
                label: 'Total',
                hint: 'Minimum/maximum sur la stat totale (base + runes + sets + artéfacts)',
              },
              {
                key: 'bonus',
                label: 'Bonus',
                hint: "Minimum/maximum sur ce que l'équipement doit apporter, au-dessus de la base du monstre choisi",
              },
            ]}
            value={statMode}
            onChange={setStatMode}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {RECO_STATS.map((st) => {
            const base = baseOf(st.key);
            const capped = CAPPED_100.has(st.key);
            const ceiling = capped ? (statMode === 'total' ? 100 : 100 - base) : undefined;

            const minTotal = minStats[st.key] ?? null;
            const minDisplayed = minTotal == null ? null : statMode === 'total' ? minTotal : minTotal - base;
            const maxTotalVal = maxStats[st.key] ?? null;
            const maxDisplayed = maxTotalVal == null ? null : statMode === 'total' ? maxTotalVal : maxTotalVal - base;

            return (
              <div
                key={st.key}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2 py-1"
              >
                <span className="text-[11.5px] text-ink-dim w-[70px]">{st.label}</span>
                <NumberField
                  value={minDisplayed}
                  onChange={(v) =>
                    setMinStats((prev) => {
                      const next = { ...prev };
                      if (v == null) delete next[st.key];
                      else next[st.key] = statMode === 'total' ? v : v + base;
                      return next;
                    })
                  }
                  allowEmpty
                  // ⚠️ En mode Total, le total ne descend jamais sous la base
                  // nue du monstre (même sans la moindre rune, elle y est
                  // déjà) : demander moins n'a pas de sens, donc ce n'est pas
                  // saisissable. En mode Bonus, un bonus négatif n'en a pas
                  // davantage.
                  min={statMode === 'total' ? base : 0}
                  max={ceiling}
                  placeholder={statMode === 'total' ? String(base) : '0'}
                  width="w-16"
                  ariaLabel={`${st.label} minimum`}
                  title="Minimum"
                />
                <span className="text-ink-dim text-[11px]">à</span>
                <NumberField
                  value={maxDisplayed}
                  onChange={(v) =>
                    setMaxStats((prev) => {
                      const next = { ...prev };
                      if (v == null) delete next[st.key];
                      else next[st.key] = statMode === 'total' ? v : v + base;
                      return next;
                    })
                  }
                  allowEmpty
                  min={statMode === 'total' ? base : 0}
                  max={ceiling}
                  placeholder={capped ? String(ceiling) : '—'}
                  width="w-16"
                  ariaLabel={`${st.label} maximum`}
                  title="Maximum"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-dim transition hoverable:text-ink"
        >
          <Settings2 size={13} /> Options avancées
        </button>
        {showAdvanced && (
          <div className="mt-2 flex flex-wrap items-start gap-4 rounded-lg border border-border bg-panel p-3">
            <div>
              <p className="text-[11.5px] text-ink-dim mb-1">Temps limite (secondes)</p>
              <NumberField
                value={maxSeconds}
                onChange={setMaxSeconds}
                allowEmpty
                min={5}
                placeholder="15"
                width="w-16"
                ariaLabel="Temps limite de recherche en secondes"
              />
              <p className="mt-1 text-[11px] text-ink-dim max-w-[220px]">
                Champ vide = pas de limite automatique — utilise « Arrêter » pour reprendre la main
                toi-même.
              </p>
            </div>
            <div>
              <p className="text-[11.5px] text-ink-dim mb-1">Pré-filtrage par emplacement</p>
              <NumberField
                value={slotFilterCap}
                onChange={setSlotFilterCap}
                allowEmpty
                min={20}
                max={80}
                placeholder="40 (défaut)"
                width="w-20"
                ariaLabel="Nombre de runes candidates conservées par emplacement"
              />
              <p className="mt-1 text-[11.5px] text-warn max-w-[260px]">
                ⚠️ Plus haut = plus de runes considérées par emplacement, mais un coût qui grandit
                très vite (mémoire ET temps) sur un gros compte — au-delà d'un certain point, la
                recherche peut planter plutôt que simplement ralentir. À monter progressivement.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExploreAll((v) => !v)}
          aria-pressed={exploreAll}
          title={
            exploreAll
              ? "Revenir aux combinaisons réellement montables sans dérunir un autre monstre"
              : "Inclure aussi les runes déjà portées par d'autres monstres de la box"
          }
          className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition ${
            exploreAll
              ? 'border-accent bg-panel2 text-ink shadow'
              : 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
          }`}
        >
          <Boxes size={15} /> Explorer tout l'inventaire
        </button>

        <button
          type="button"
          onClick={handleSearch}
          disabled={!selected || status === 'running'}
          className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent-soft px-3.5 py-2 text-[13px] font-semibold
                     text-ink transition hoverable:shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'running' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Search size={15} />
          )}
          {status === 'running' ? 'Recherche…' : 'Rechercher'}
        </button>

        {status === 'running' && (
          <button
            type="button"
            onClick={() => {
              setStoppedManually(true);
              stop();
            }}
            title="Arrêter la recherche et garder ce qui a déjà été trouvé"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px] font-semibold
                       text-ink-dim transition hoverable:text-bad hoverable:border-bad"
          >
            <Square size={13} /> Arrêter
          </button>
        )}
      </div>

      {status === 'error' && (
        <p className="text-[12.5px] text-bad">La recherche a échoué. Réessaie avec des critères moins stricts.</p>
      )}

      {result && (
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="label">
              {result.candidates.length === 0
                ? 'Aucune combinaison ne répond à ces critères'
                : `${result.candidates.length} combinaison(s) trouvée(s)${
                    result.candidates.length > 20 ? ' · 20 affichées' : ''
                  }`}
            </p>
            {result.candidates.length > 0 && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-panel border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none
                           focus:border-accent"
              >
                <optgroup label="Stats">
                  <option value="eff">Trier par efficience</option>
                  {RECO_STATS.map((st) => (
                    <option key={st.key} value={st.key}>
                      Trier par {st.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Objectifs">
                  {OBJECTIVE_LABELS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>

          {result.truncated && (
            <p className="mb-2 text-[11.5px] text-warn">
              {stoppedManually
                ? `Recherche arrêtée après examen de ${result.explored.toLocaleString('fr-FR')} combinaisons — voici le meilleur trouvé jusque-là.`
                : `Recherche interrompue après examen de ${result.explored.toLocaleString('fr-FR')} combinaisons — resserre tes critères pour un résultat exhaustif.`}
            </p>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {sortedCandidates.map((c, i) => (
              <BuildCandidateCard
                key={c.runeIds.join('-')}
                rank={i + 1}
                candidate={c}
                runeById={runeById}
                metric={metric}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
