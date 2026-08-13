import { Fragment, useMemo } from 'react';
import { Search, Boxes, Square, Settings2, HelpCircle, RotateCcw, FlaskConical } from 'lucide-react';
import { ArtifactDetail, ARTIFACT_KINDS, RECO_STATS, RuneDetail } from '../../types';
import { BoxItem } from '../../lib/applyAccount';
import { ARTIFACT_MAIN, CAPPED_STATS, RUNE_EFFECT, StatKey, runeEfficiency } from '../../lib/effects';
import {
  BuildRequirement,
  SLOT_MAIN_OPTIONS,
  excludedRuneIds,
  estimateSearchSpace,
  statTotal,
  objectiveScore,
  candidateMetricTotal,
  OBJECTIVE_LABELS,
} from '../../lib/runeBuildOptim';
import { ArtifactMainChoice, OptimizerState, OptimizerSortKey } from '../../hooks/useOptimizerState';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import NumberField from '../NumberField';
import MonsterAvatar from '../MonsterAvatar';
import MonsterGear from '../MonsterGear';
import Segmented from '../Segmented';
import Switch from '../Switch';
import MonsterGearPicker, { GearedMonster } from './MonsterGearPicker';
import SetComboPicker from './SetComboPicker';
import BuildCandidateCard from './BuildCandidateCard';

interface Props {
  box: BoxItem[];
  runes: RuneDetail[];
  // Remontée dans App.tsx (voir useOptimizerState) : la page est démontée à
  // chaque changement d'onglet, comme les autres pages de l'app — sans cette
  // remontée, toute la saisie (monstre, conditions, résultats…) serait
  // perdue au moindre aller-retour vers un autre onglet.
  optimizer: OptimizerState;
}

// ⚠️ Le plafond de CAPPED_STATS (voir lib/effects.ts) ne s'applique QU'À la
// saisie d'une condition (minimum ou maximum) : la RECHERCHE, elle, ne doit
// surtout pas exclure un build dont la somme brute dépasse 100 % — c'est un
// résultat légitime, seule la demande d'un seuil > 100 % n'a pas de sens.
const CAPPED_100 = CAPPED_STATS;

// « Stats de base exclues » n'affecte QUE ces 4 stats (PV/ATQ/DEF/VIT) : elles
// ont une base qui grandit avec le niveau/l'éveil et que les runes viennent
// gonfler en % ou en plat. Taux Crit/Dgts Crit/RES/Précision partent d'une
// petite valeur d'éveil fixe et restent TOUJOURS en TOTAL, quel que soit ce
// réglage — demandé explicitement : elles « évoluent suivant la valeur
// d'éveil des monstres », pas selon un mode bonus/total.
const BASE_TOGGLE_STATS = new Set<StatKey>(['hp', 'atk', 'def', 'spd']);

const CONFIGURABLE_SLOTS: (2 | 4 | 6)[] = [2, 4, 6];

// Les trois valeurs de statistique principale d'artéfact possibles en jeu
// (voir ARTIFACT_MAIN dans effects.ts pour les codes 100/101/102) — la
// valeur elle-même n'est jamais un choix libre, seule la STAT l'est.
const ARTIFACT_MAIN_VALUE: Record<100 | 101 | 102, number> = { 100: 1500, 101: 100, 102: 100 };
const ARTIFACT_MAIN_OPTIONS: { code: 100 | 101 | 102; label: string }[] = [
  { code: 101, label: 'ATQ +100' },
  { code: 102, label: 'DEF +100' },
  { code: 100, label: 'PV +1500' },
];

// Pré-filtrage par emplacement, en PRESETS plutôt qu'un curseur libre —
// calibré par mesure sur un vrai compte (voir spec/outils/optimizer.md,
// « Validation grandeur nature ») : 40 est le défaut historique, 300 est la
// valeur qui a permis de retrouver un build réel sur un très gros compte.
const SLOT_FILTER_PRESETS: { key: 'bas' | 'moyen' | 'haut' | 'extreme'; label: string; cap: number; hint: string }[] = [
  { key: 'bas', label: 'Bas', cap: 40, hint: 'Rapide — suffit la plupart du temps.' },
  { key: 'moyen', label: 'Moyen', cap: 80, hint: 'Un peu plus large, coût encore modéré.' },
  { key: 'haut', label: 'Haut', cap: 150, hint: 'Nettement plus de runes considérées — recherche plus lente.' },
  {
    key: 'extreme',
    label: 'Extrême',
    cap: 300,
    hint: 'Valeur mesurée nécessaire pour retrouver un vrai build sur un très gros compte — peut prendre plusieurs dizaines de secondes.',
  },
];

function formatBig(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n < 1_000_000_000) return Math.round(n).toLocaleString('fr-FR');
  return n.toExponential(1);
}

// Outil « Optimizer » : cherche, parmi les runes du compte, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre, un combo de sets et des
// minimums de stats donnés. Voir spec/outils/optimizer.md.
export default function OptimizerSection({ box, runes, optimizer }: Props) {
  const metric = useRuneMetric();
  const {
    selectedId,
    setSelectedId,
    comboSets,
    setComboSets,
    setPickerInvalid,
    setSetPickerInvalid,
    minStats,
    setMinStats,
    maxStats,
    setMaxStats,
    excludeBase,
    setExcludeBase,
    ignoreArtifacts,
    setIgnoreArtifacts,
    artifactMainByKind,
    setArtifactMainByKind,
    mainStatsBySlot,
    setMainStatsBySlot,
    objective,
    setObjective,
    exploreAll,
    setExploreAll,
    sortBy,
    setSortBy,
    showAdvanced,
    setShowAdvanced,
    slotFilterPreset,
    setSlotFilterPreset,
    stoppedManually,
    setStoppedManually,
    openRuneKey,
    setOpenRuneKey,
    search,
  } = optimizer;
  const { status, result, progress, run, stop } = search;

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

  const selected = gearedMonsters.find((g) => String(g.monster.id) === selectedId) ?? null;

  // Statistiques principales autorisées sur les slots 2/4/6 — vide = libre.
  // Voir spec/outils/optimizer.md : pour un Lushen, ATQ% en 2, Dmg Crit en 4,
  // ATQ% en 6 — sans cette contrainte, ces slots partent dans n'importe quel
  // sens et noient le pré-filtrage sous des runes hors sujet.
  function toggleMainStat(slot: 2 | 4 | 6, code: number) {
    setMainStatsBySlot((prev) => {
      const cur = prev[slot] ?? [];
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...prev, [slot]: next };
    });
  }

  const slotFilterCap = SLOT_FILTER_PRESETS.find((p) => p.key === slotFilterPreset)!.cap;
  // Filet de sécurité fixe, large, PAS un réglage utilisateur : le bouton
  // « Arrêter » reste le vrai moyen de reprendre la main. 10 min, pas 15 s :
  // une recherche légitimement longue (preset Extrême sur un gros compte,
  // voir « Validation grandeur nature ») ne doit pas être coupée avant
  // d'avoir eu sa chance d'aboutir.
  const HARD_TIMEOUT_MS = 10 * 60 * 1000;

  const runeById = useMemo(() => new Map(runes.map((r) => [r.id, r])), [runes]);

  // ⚠️ Exclusion par défaut : ne propose que des combos réellement montables
  // sans dérunir un autre monstre de la box. « Explorer tout l'inventaire »
  // lève la contrainte. Voir spec/outils/optimizer.md.
  const pool = useMemo(() => {
    if (!selected) return runes;
    const excluded = exploreAll
      ? new Set<number>()
      : excludedRuneIds(
          box.map((b) => ({ unitKey: b.key, com2usId: b.monster.com2usId, gear: b.gear })),
          selected.monster.com2usId
        );
    return excluded.size === 0 ? runes : runes.filter((r) => !excluded.has(r.id));
  }, [selected, exploreAll, box, runes]);

  // Artéfacts RÉELLEMENT transmis au moteur — indépendants de ceux affichés
  // dans « Équipement actuel » (toujours les VRAIS, une photo de l'existant,
  // jamais modifiée par ces réglages). `ignoreArtifacts` coché = aucun
  // artéfact compté. Sinon, chaque emplacement (Attribut/Type, voir
  // ARTIFACT_KINDS) suit son propre choix : `'equipped'` (défaut) reprend
  // l'artéfact réellement porté à cet emplacement DU BUILD DE BASE —
  // comportement historique inchangé tant que rien n'est touché — un code
  // de stat HYPOTHÈQUE un artéfact différent (même sans le posséder),
  // `'none'` retire cet emplacement même s'il est réellement équipé.
  // ⚠️ **`selected.gear` est TOUJOURS le build de base** (voir
  // `gearedMonsters`, dérivé de `box`) — jamais celui de RTA ni d'un deck de
  // siège, qui peuvent porter des artéfacts DIFFÉRENTS pour le MÊME monstre
  // (presets de runage/artéfacts séparés, pas une seule vérité par monstre).
  // `'equipped'` par défaut est donc une hypothèse implicite (« le build de
  // base »), pas une garantie que ça matche le build qu'un joueur cherche
  // réellement à reproduire — d'où l'intérêt des deux autres choix pour
  // hypothéquer un artéfact différent sans avoir à changer de monstre.
  const searchArtifacts = useMemo<ArtifactDetail[]>(() => {
    if (!selected || ignoreArtifacts) return [];
    const out: ArtifactDetail[] = [];
    for (const { key } of ARTIFACT_KINDS) {
      const choice = artifactMainByKind[key] ?? 'equipped';
      if (choice === 'none') continue;
      if (choice === 'equipped') {
        const real = selected.gear.artifacts.find((a) => a.kind === key);
        if (real) out.push(real);
        continue;
      }
      out.push({ kind: key, level: 1, rarity: 5, main: { code: choice, value: ARTIFACT_MAIN_VALUE[choice] }, subs: [] });
    }
    return out;
  }, [selected, ignoreArtifacts, artifactMainByKind]);

  // Ce que le moteur reçoit réellement — partagé entre la recherche et
  // l'estimation affichée avant de lancer quoi que ce soit (voir plus bas) :
  // les deux doivent voir EXACTEMENT la même exigence.
  const requirement = useMemo<BuildRequirement>(() => {
    const mainStatsReq: NonNullable<BuildRequirement['mainStats']> = {};
    for (const slot of CONFIGURABLE_SLOTS) {
      const codes = mainStatsBySlot[slot];
      if (codes && codes.length > 0) mainStatsReq[slot] = codes;
    }
    return { sets: comboSets, minStats, maxStats, mainStats: mainStatsReq };
  }, [comboSets, minStats, maxStats, mainStatsBySlot]);

  // Indication du nombre de builds qui vont être testés — un ORDRE DE
  // GRANDEUR (le produit des pools filtrés par emplacement), pas le nombre
  // réellement exploré : le meet-in-the-middle n'énumère jamais ce produit en
  // entier. Utile pour juger si les critères actuels sont trop larges ou trop
  // stricts avant d'attendre un résultat.
  const estimate = useMemo(() => {
    if (!selected || comboSets.length === 0) return null;
    return estimateSearchSpace(pool, requirement, slotFilterCap, objective);
  }, [selected, comboSets, pool, requirement, slotFilterCap, objective]);

  function handleSearch() {
    if (!selected) return;
    if (comboSets.length === 0) {
      setSetPickerInvalid(true);
      return;
    }
    setSetPickerInvalid(false);
    setStoppedManually(false);
    setSortBy(objective);
    run({
      base: selected.gear.base,
      artifacts: searchArtifacts,
      relic: selected.gear.relic,
      pool,
      requirement,
      metric,
      maxMs: HARD_TIMEOUT_MS,
      slotFilterCap,
      objective,
    });
  }

  // Tri CLIENT, sans relancer la recherche : le moteur collecte déjà les
  // stats complètes de chaque candidat valide (voir runeBuildOptim.ts).
  const sortedCandidates = useMemo(() => {
    if (!result) return [];
    const list = result.candidates.slice();
    if (sortBy === 'efficience') {
      // ⚠️ PAS `objectiveScore`/`effTotal` ici : ce champ est figé dans la
      // mesure active AU MOMENT DE LA RECHERCHE, et deviendrait incohérent
      // avec le popover d'une rune (recalculé en direct) si l'utilisateur
      // bascule Efficience ↔ Score après coup sans relancer.
      list.sort((a, b) => candidateMetricTotal(b, runeById, metric) - candidateMetricTotal(a, runeById, metric));
    } else if (sortBy === 'degats' || sortBy === 'ehp' || sortBy === 'vitesse') {
      list.sort((a, b) => objectiveScore(b, sortBy) - objectiveScore(a, sortBy));
    } else {
      list.sort((a, b) => statTotal(b.stats, sortBy) - statTotal(a.stats, sortBy));
    }
    return list.slice(0, 20);
  }, [result, sortBy, runeById, metric]);

  // Base « nue » du monstre choisi pour une stat — 0 tant qu'aucun monstre
  // n'est sélectionné. ⚠️ N'inclut PAS les artéfacts : en jeu, le mode
  // « bonus » (stats de base exclues) désigne tout ce qui n'est PAS la base
  // pure du monstre — runes ET artéfacts ensemble — un monstre sans la
  // moindre rune mais avec deux artéfacts ATQ+100 affiche déjà +200 ATQ en
  // bonus. La conversion affichage↔stockage doit donc rester bâtie sur la
  // seule base brute ; c'est `artifactBonusOf` ci-dessous qui sert de
  // PLANCHER visible dans le champ, séparément.
  function baseOf(key: StatKey): number {
    return selected ? (selected.gear.base as unknown as Record<StatKey, number>)[key] : 0;
  }

  // Contribution des artéfacts EFFECTIVEMENT comptés (voir searchArtifacts)
  // à une stat donnée — 0 si `ignoreArtifacts` ou si aucun artéfact n'est
  // supposé sur cette stat. Sert de PLANCHER pour les conditions ci-dessous :
  // avec zéro rune, un monstre a déjà AU MOINS ce bonus en jeu (voir
  // `baseOf`) — le champ ne doit jamais laisser demander moins. N'affecte
  // que PV/ATQ/DEF (ARTIFACT_MAIN ne couvre que ces trois stats — VIT/TC/
  // DCC/RES/Précision ne reçoivent jamais rien d'un artéfact).
  function artifactBonusOf(key: StatKey): number {
    return searchArtifacts.reduce((sum, a) => {
      const def = ARTIFACT_MAIN[a.main.code];
      return def?.stat === key ? sum + a.main.value : sum;
    }, 0);
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* ⚠️ Pas de `useStickyState`/case à fermer, contrairement à
          MobileNotice : ce n'est pas un avertissement ponctuel mais un statut
          qui reste vrai tant que l'outil est en rodage — il doit rester
          visible à chaque visite, pas disparaître après un premier clic. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/60 bg-warn/10 px-3 py-2.5">
        <FlaskConical size={16} className="mt-0.5 flex-none text-warn" />
        <p className="flex-1 text-[12px] leading-relaxed text-ink-dim">
          <b className="text-ink">Optimizer en bêta.</b> L'outil est encore en rodage : le moteur de
          recherche peut mettre du temps sur des critères serrés ou manquer un build sur un cas
          inhabituel — vérifie toujours le résultat avant de re-runer.
        </p>
      </div>

      <p className="text-[13px] text-ink-dim">
        Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement
        indicatif — c'est à toi de re-runer dans le jeu.
      </p>

      <div>
        <p className="label mb-1.5">Monstre à optimiser</p>
        <MonsterGearPicker items={gearedMonsters} onPick={setSelectedId} />
      </div>

      {selected && (
        <div className="rounded-xl border border-accent bg-panel/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <MonsterAvatar monster={selected.monster} size={32} />
            <span className="font-semibold text-[14px]">{selected.monster.name}</span>
          </div>
          {/* ⚠️ Même composant que RTA/Siège quand on clique un monstre — pas
              une réimplémentation : stats base/bonus, artéfacts, roue de
              runes et relique tels qu'ACTUELLEMENT équipés, chacun cliquable
              pour son détail complet (RuneDetailBox/ArtifactDetailBox/
              RelicDetailBox), inline sous la roue. Ce que l'Optimizer part
              d'optimiser, visible d'un coup d'œil avant de lancer quoi que
              ce soit. */}
          <MonsterGear gear={selected.gear} />
        </div>
      )}

      <div
        className={
          setPickerInvalid
            ? 'rounded-lg border-2 border-red-500 bg-red-500/15 ring-4 ring-red-500/50 p-2 -m-2 transition'
            : 'transition'
        }
      >
        <p className="label mb-1.5">Set de runes recherché</p>
        <SetComboPicker
          sets={comboSets}
          onChange={(next) => {
            setComboSets(next);
            if (next.length > 0) setSetPickerInvalid(false);
          }}
        />
        {setPickerInvalid && (
          <p className="mt-1.5 text-[11.5px] font-semibold text-red-500">
            Sélectionne au moins un set avant de lancer la recherche.
          </p>
        )}
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
        <p className="label mb-1.5">Objectif de recherche</p>
        <Segmented options={OBJECTIVE_LABELS} value={objective} onChange={setObjective} size="lg" />
        <p className="mt-1 text-[11px] text-ink-dim">
          Oriente le type de rune étudié dès le pré-filtrage, avant même de lancer la recherche — pas
          seulement l'ordre des résultats. Dégâts considère ATQ, Taux Crit et Dgts Crit ensemble
          (espérance moyenne).
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <p className="label">Artéfacts</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-ink-dim">Ignorer les statistiques des artéfacts</span>
            <span title="Activé, la recherche ne compte AUCUNE statistique d'artéfact (comme si le monstre n'en portait pas). Désactivé, choisis la statistique principale à supposer pour chaque emplacement ci-dessous.">
              <HelpCircle size={13} className="text-ink-dim" />
            </span>
            <Switch
              checked={ignoreArtifacts}
              onChange={setIgnoreArtifacts}
              label="Ignorer les statistiques des artéfacts"
            />
          </div>
        </div>
        {!ignoreArtifacts && (
          <div className="flex flex-wrap gap-3">
            {ARTIFACT_KINDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-[12.5px] text-ink w-14">{label}</span>
                <select
                  value={String(artifactMainByKind[key] ?? 'equipped')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next: ArtifactMainChoice = raw === 'equipped' || raw === 'none' ? raw : (Number(raw) as 100 | 101 | 102);
                    setArtifactMainByKind((prev) => ({ ...prev, [key]: next }));
                  }}
                  className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
                >
                  <option value="equipped">Comme équipé</option>
                  {ARTIFACT_MAIN_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                  <option value="none">Aucun</option>
                </select>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-ink-dim">
          « Comme équipé » reprend l'artéfact du build de base (celui affiché ci-dessus) porté à cet
          emplacement. Choisir une statistique l'hypothèque pour la recherche sans avoir besoin de le
          posséder — utile si ce monstre porte des artéfacts différents en RTA ou dans un deck de siège,
          puisque ce build de base n'est pas forcément celui que tu cherches à reproduire ; « Aucun »
          retire l'emplacement même s'il est réellement équipé.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <p className="label">Conditions</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-ink-dim">Stats de base exclues</span>
            <span
              title="PV/ATQ/DEF/VIT : activé, la valeur est ce que l'équipement (runes ET artéfacts comptés) doit apporter au-dessus de la base du monstre. Désactivé, elle porte sur le total. Taux Crit/Dgts Crit/RES/Précision restent toujours en total, quel que soit ce réglage — ils partent de la valeur d'éveil du monstre."
            >
              <HelpCircle size={13} className="text-ink-dim" />
            </span>
            <Switch
              checked={excludeBase}
              onChange={setExcludeBase}
              label="Stats de base exclues des conditions PV/ATQ/DEF/VIT"
            />
          </div>
        </div>
        {/* ⚠️ `boxWidth` fixe sur CHAQUE NumberField ci-dessous (voir
            NumberField.tsx) : sans ça, un champ avec suffixe « % » serait
            TOUJOURS plus large qu'un champ sans suffixe à largeur de texte
            égale (le suffixe prend de la place en plus), et les colonnes
            Min/Max ne s'aligneraient pas d'une stat à l'autre. */}
        <div className="grid grid-cols-[minmax(90px,auto)_auto_auto] gap-y-1.5 gap-x-4 items-center">
          {RECO_STATS.map((st) => {
            const affectedByToggle = BASE_TOGGLE_STATS.has(st.key);
            const base = baseOf(st.key);
            const artBonus = artifactBonusOf(st.key);
            const capped = CAPPED_100.has(st.key);
            const bonusMode = affectedByToggle && excludeBase;
            const ceiling = capped ? (bonusMode ? 100 - base : 100) : undefined;
            // ⚠️ Plancher affiché/autorisé, PAS la même chose que `base` (qui
            // sert à la conversion affichage↔stockage, voir `baseOf`) : avec
            // zéro rune, un monstre a déjà AU MOINS ce bonus/total en jeu
            // (base nue + artéfacts éventuellement comptés) — voir
            // `artifactBonusOf`. En mode bonus, seul l'artéfact compte (la
            // base nue est déjà soustraite par la conversion elle-même) ; en
            // mode total, base ET artéfact s'additionnent.
            const floor = bonusMode ? artBonus : base + artBonus;

            const minTotal = minStats[st.key] ?? null;
            const minDisplayed = minTotal == null ? null : bonusMode ? minTotal - base : minTotal;
            const maxTotalVal = maxStats[st.key] ?? null;
            const maxDisplayed = maxTotalVal == null ? null : bonusMode ? maxTotalVal - base : maxTotalVal;

            return (
              <Fragment key={st.key}>
                <span className="text-[12.5px] text-ink">{st.label}</span>
                <div className="flex items-center gap-1.5">
                  <NumberField
                    value={minDisplayed}
                    onChange={(v) =>
                      setMinStats((prev) => {
                        const next = { ...prev };
                        if (v == null) delete next[st.key];
                        else next[st.key] = bonusMode ? v + base : v;
                        return next;
                      })
                    }
                    allowEmpty
                    // ⚠️ Le total (ou le bonus, artéfacts comptés) ne descend
                    // jamais sous ce plancher — même sans la moindre rune, il
                    // est déjà garanti (base nue en mode total, artéfacts en
                    // mode bonus).
                    min={floor}
                    max={ceiling}
                    placeholder={String(floor)}
                    suffix={st.suffix || undefined}
                    boxWidth="w-24"
                    ariaLabel={`${st.label} minimum`}
                    title="Minimum"
                  />
                  <span className="text-ink-dim text-[11px]">Min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <NumberField
                    value={maxDisplayed}
                    onChange={(v) =>
                      setMaxStats((prev) => {
                        const next = { ...prev };
                        if (v == null) delete next[st.key];
                        else next[st.key] = bonusMode ? v + base : v;
                        return next;
                      })
                    }
                    allowEmpty
                    min={floor}
                    max={ceiling}
                    placeholder={capped ? String(ceiling) : '—'}
                    suffix={st.suffix || undefined}
                    boxWidth="w-24"
                    ariaLabel={`${st.label} maximum`}
                    title="Maximum"
                  />
                  <span className="text-ink-dim text-[11px]">Max</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="flex justify-end mt-1.5">
          <button
            type="button"
            onClick={() => {
              setMinStats({});
              setMaxStats({});
            }}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-dim transition hoverable:text-bad"
          >
            <RotateCcw size={13} /> Réinitialiser les conditions
          </button>
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
          <div className="mt-2 rounded-lg border border-border bg-panel p-3">
            <p className="text-[11.5px] text-ink-dim mb-1">Pré-filtrage par emplacement</p>
            <div className="flex items-center gap-1 bg-panel2 border border-border rounded-lg p-0.5 w-fit">
              {SLOT_FILTER_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSlotFilterPreset(p.key)}
                  title={p.hint}
                  aria-pressed={slotFilterPreset === p.key}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
                    slotFilterPreset === p.key ? 'bg-accent-soft text-ink' : 'text-ink-dim hoverable:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-warn max-w-[280px]">
              ⚠️ {SLOT_FILTER_PRESETS.find((p) => p.key === slotFilterPreset)?.hint}
            </p>
          </div>
        )}
      </div>

      {estimate && (
        <p className="font-mono text-[11.5px] text-ink-dim">
          ≈ {formatBig(estimate.product)} combinaisons brutes après filtrage (pool par emplacement :{' '}
          {estimate.perSlot.join(' × ')}) — un ordre de grandeur, pas le nombre réellement exploré par
          l'algorithme.
        </p>
      )}

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
          <Search size={15} />
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

      {/* ⚠️ Deux phases distinctes affichées différemment, pas une seule
          barre continue : `building` (construction des compartiments, avant
          même de savoir combien de paires il y aura à explorer) et `pairing`
          (l'ancienne barre, inchangée) ne partagent pas la même notion de
          progression — les mélanger sous un seul repère aurait été plus
          trompeur qu'utile (la barre aurait pu reculer en changeant de
          phase). Avant ce correctif, `progress` restait `null` pendant toute
          la phase `building` (jusqu'à ~1 minute sur un compte réel à
          beaucoup de conditions) : la barre affichait 0 % sans bouger et le
          texte « 0 combinaisons examinées », sans dire qu'un TRAVAIL était
          en cours — voir spec/outils/optimizer.md. */}
      {status === 'running' && progress?.phase === 'building' && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
            <div
              className="h-full bg-accent/60 transition-[width] duration-150 ease-out"
              style={{ width: `${Math.round(progress.pct * 100)}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-ink-dim">
            Préparation — moitié {progress.half} : {progress.scanned.toLocaleString('fr-FR')} /{' '}
            {progress.total.toLocaleString('fr-FR')} runes
          </p>
        </div>
      )}
      {status === 'running' && (progress === null || progress.phase === 'pairing') && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
            <div
              className="h-full bg-accent transition-[width] duration-150 ease-out"
              style={{ width: `${Math.round((progress?.pct ?? 0) * 100)}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-ink-dim">
            {progress === null
              ? 'Préparation…'
              : `${progress.explored.toLocaleString('fr-FR')} combinaisons examinées · ${progress.found.toLocaleString('fr-FR')} trouvée(s)`}
          </p>
        </div>
      )}

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
                onChange={(e) => setSortBy(e.target.value as OptimizerSortKey)}
                className="bg-panel border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none
                           focus:border-accent"
              >
                <optgroup label="Stats">
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

          {/* ⚠️ minmax calibré à 360px pour que DEUX cartes tiennent par
              ligne dans le conteneur `max-w-3xl` (768px, voir plus haut) :
              2×360 + le gap (12px) = 732px, sous les 768px disponibles. Les
              cartes affichent stats + artéfacts + roue sur une seule LIGNE
              (voir BuildCandidateCard.tsx), calibrées pour tenir dans cette
              largeur (`WHEEL_SCALE`/`ARTIFACT_SCALE` = 0,45). */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3">
            {sortedCandidates.map((c, i) => (
              <BuildCandidateCard
                key={c.runeIds.join('-')}
                rank={i + 1}
                candidate={c}
                runeById={runeById}
                // ⚠️ `searchArtifacts`, PAS `selected.gear.artifacts` : les
                // stats affichées sur chaque carte (candidate.stats) ont été
                // calculées avec CES artéfacts (réels, hypothétiques ou
                // aucun selon les réglages ci-dessus) — montrer les VRAIS
                // artéfacts ici serait incohérent dès qu'ils diffèrent
                // (`ignoreArtifacts`, ou une hypothèse choisie).
                artifacts={searchArtifacts}
                metric={metric}
                openRuneKey={openRuneKey}
                onToggleRune={(key) => setOpenRuneKey((cur) => (cur === key ? null : key))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
