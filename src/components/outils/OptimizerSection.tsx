import { useMemo, useState } from 'react';
import { Search, Boxes } from 'lucide-react';
import { RECO_STATS, RuneDetail } from '../../types';
import { BoxItem } from '../../lib/applyAccount';
import { computeStats } from '../../lib/stats';
import { StatKey, runeEfficiency } from '../../lib/effects';
import { BuildRequirement, excludedRuneIds } from '../../lib/runeBuildOptim';
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
// la saisie d'une condition minimum : la RECHERCHE, elle, ne doit surtout pas
// exclure un build dont la somme brute dépasse 100 % — c'est un résultat
// légitime, seule la demande d'un minimum > 100 % n'a pas de sens.
const CAPPED_100 = new Set<StatKey>(['cr', 'res', 'acc']);

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
  const [statMode, setStatMode] = useState<'bonus' | 'total'>('total');
  const [exploreAll, setExploreAll] = useState(false);
  const [sortBy, setSortBy] = useState<StatKey | 'eff'>('eff');

  const { status, result, run } = useBuildOptimSearch();

  const runeById = useMemo(() => new Map(runes.map((r) => [r.id, r])), [runes]);

  function handleSearch() {
    if (!selected) return;
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
    const requirement: BuildRequirement = { sets: comboSets, minStats };
    run({
      base: selected.gear.base,
      artifacts: selected.gear.artifacts,
      relic: selected.gear.relic,
      pool,
      requirement,
      metric,
    });
  }

  // Tri CLIENT, sans relancer la recherche : le moteur collecte déjà les
  // stats complètes de chaque candidat valide (voir runeBuildOptim.ts).
  const sortedCandidates = useMemo(() => {
    if (!result) return [];
    const list = result.candidates.slice();
    if (sortBy === 'eff') list.sort((a, b) => b.effTotal - a.effTotal);
    else
      list.sort((a, b) => {
        const ra = a.stats.find((s) => s.key === sortBy)?.total ?? 0;
        const rb = b.stats.find((s) => s.key === sortBy)?.total ?? 0;
        return rb - ra;
      });
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
        <div className="flex items-center justify-between mb-1.5">
          <p className="label">Conditions minimum</p>
          <Segmented
            options={[
              {
                key: 'total',
                label: 'Total',
                hint: 'Minimum sur la stat totale (base + runes + sets + artéfacts)',
              },
              {
                key: 'bonus',
                label: 'Bonus',
                hint: "Minimum sur ce que l'équipement doit apporter, au-dessus de la base du monstre choisi",
              },
            ]}
            value={statMode}
            onChange={setStatMode}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {RECO_STATS.map((st) => {
            const base = baseOf(st.key);
            const total = minStats[st.key] ?? null;
            const displayed = total == null ? null : statMode === 'total' ? total : total - base;
            const capped = CAPPED_100.has(st.key);
            const max = capped ? (statMode === 'total' ? 100 : 100 - base) : undefined;
            return (
              <div
                key={st.key}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2 py-1"
              >
                <span className="text-[11.5px] text-ink-dim w-[70px]">{st.label}</span>
                <NumberField
                  value={displayed}
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
                  max={max}
                  placeholder={statMode === 'total' ? String(base) : '0'}
                  width="w-16"
                />
              </div>
            );
          })}
        </div>
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
          <Search size={15} /> {status === 'running' ? 'Recherche…' : 'Rechercher'}
        </button>
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
                onChange={(e) => setSortBy(e.target.value as StatKey | 'eff')}
                className="bg-panel border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none
                           focus:border-accent"
              >
                <option value="eff">Trier par efficience</option>
                {RECO_STATS.map((st) => (
                  <option key={st.key} value={st.key}>
                    Trier par {st.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {result.truncated && (
            <p className="mb-2 text-[11.5px] text-warn">
              Recherche interrompue après examen de {result.explored.toLocaleString('fr-FR')} combinaisons —
              resserre tes critères pour un résultat exhaustif.
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
