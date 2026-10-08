import { memo, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw, AlertTriangle, PackageCheck, Swords, Lock, Hammer, Gem, ChevronDown, Tag } from 'lucide-react';
import { CraftLine, RuneDetail } from '../../types';
import { formatRuneEffect, RUNE_EFFECT } from '../../lib/effects';
import { runePotential, RunePotential, runePlan, planNeeds } from '../../lib/runeOptim';
import {
  PERIMETRES_UTILISES,
  PerimetreUtilise,
  RunesUtilisees,
  unionRunesUtilisees,
} from '../../lib/importAccount';
import { CraftStock, EMPTY_STOCK, buildCraftStock, dispoReserve } from '../../lib/crafts';
import { useRuneMetric, formatRuneMetric, convertirPalier, runeMetricValue } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import { useMediaQuery, SOUS_LG } from '../../hooks/useMediaQuery';
import RuneSlotIcon from '../RuneSlotIcon';
import Pager from './Pager';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import FiltresRunes from './FiltresRunes';
import NumberField from '../../ui/NumberField';
import Selecteur from '../../ui/Selecteur';
import Bouton from '../../ui/Bouton';
import Segmented from '../../ui/Segmented';
import BoutonSensTri from '../BoutonSensTri';
import { SENS_PAR_DEFAUT, SensTri, signeTri } from '../../lib/tri';
import { BoutonIcone, Case, FlottantAuto } from '../../ui';
import MobileSheet from '../../ui/MobileSheet';
import HelpPopover from '../HelpPopover';
import AncientFilter, {
  AncientFilter as AncientFilterValue,
  keepAncient,
  normFiltreAntique,
} from './AncientFilter';

interface Props {
  runes: RuneDetail[];
  crafts: CraftLine[];
  // `rune_id` des runes UTILISÉES, par périmètre : posées sur un monstre d'un
  // deck — tous contenus confondus — ou en RTA. Voir
  // `parseUsedRuneIdsParPerimetre`.
  usedRuneIds: RunesUtilisees;
  // Libellés des marqueurs de runes (numéro → texte saisi en jeu). Un marqueur
  // sans libellé en est absent.
  runeMarkerLabels: Record<number, string>;
  // Panneau d'actions mobile — piloté par le bouton « Options » (voir App.tsx),
  // comme la Liste. Ne s'ouvre que sous `lg`.
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

// Exporté : la section « Meules » réutilise la même tuile, pour qu'une rune se
// présente pareil d'un onglet à l'autre.
export interface OptimRow {
  rune: RuneDetail;
  pot: RunePotential;
  id: number;
}

type SortMode = 'gainLegend' | 'gainHero' | 'effCur' | 'potHero' | 'potLegend';
const PAGE = 60;

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'effCur', label: 'Valeur actuelle' },
  { key: 'potHero', label: 'Potentiel héroïque' },
  { key: 'potLegend', label: 'Potentiel légendaire' },
  { key: 'gainHero', label: 'Gain héroïque' },
  { key: 'gainLegend', label: 'Gain légendaire' },
];

const SORT_VAL: Record<SortMode, (p: RunePotential) => number> = {
  gainLegend: (p) => p.legendGain,
  gainHero: (p) => p.heroGain,
  effCur: (p) => p.eff,
  potHero: (p) => p.heroEff,
  potLegend: (p) => p.legendEff,
};

// Scénario (héro/légend) du plan affiché au clic, déduit du tri.
const scenarioOf = (s: SortMode): 'hero' | 'legend' =>
  s === 'gainHero' || s === 'potHero' ? 'hero' : 'legend';

// Gain signé (« +2.3 » / « -1.4 »), à la précision de la mesure (score = entier).
export const signed = (g: number, metric: 'eff' | 'score') =>
  (g >= 0 ? '+' : '') + (metric === 'eff' ? g.toFixed(1) : String(Math.round(g)));

// Valeur de filtre d'une rune SANS marqueur. Les marqueurs du jeu vont de 1 à 8.
const SANS_MARQUEUR = 0;

// Une case d'un filtre à cases : son libellé (nombre de runes compris), son
// état, et l'action qui la bascule.
interface ChoixCase {
  cle: string | number;
  libelle: string;
  coche: boolean;
  basculer: () => void;
}

// FILTRE À CASES — un bouton qui allume le filtre, et des cases qui choisissent
// ce qu'il garde. « Runes utilisées » (périmètres) et « Marqueurs » partagent ce
// gabarit : même geste, même rendu, un seul endroit où il peut diverger.
//
// ⚠️ **Deux supports, un par format**, et aucun ne déplace ce qu'on clique :
//  - au BUREAU (`large` faux), un bouton d'icône voisin ouvre les cases dans
//    un `FlottantAuto` — hors du flux. Fermé par un clic ailleurs ou Échap ;
//  - dans le panneau « Options » au DOIGT (`large`), les cases sont rendues EN
//    PERMANENCE sous le bouton : leur place est réservée, et aucun flottant ne
//    s'ouvre dans le tiroir (règles descendantes `[data-tiroir]`).
// Les cases n'agissent que filtre allumé : chevron désactivé / cases grisées
// sinon.
//
// ⚠️ `w-full` au doigt : le panneau aligne ses `.flex-col` à gauche
// (`[data-tiroir] .flex-col`, index.css). Sans lui, ce conteneur prend la
// largeur de son contenu, et le `w-full` du bouton ne remplit plus que lui —
// le bouton redevenait plus étroit que ses voisins (vu en capture). `flex-col`
// est gardé pour que le bouton reçoive les mêmes règles `.flex-col > button`
// que « Faisable avec ma réserve ».
function FiltreACases({
  large,
  actif,
  disabled = false,
  onBascule,
  title,
  icone,
  libelle,
  libelleChoix,
  tous,
  choix,
}: {
  large: boolean;
  actif: boolean;
  disabled?: boolean;
  onBascule: () => void;
  title: string;
  icone: ReactNode;
  libelle: string;
  // `aria-label` du chevron qui ouvre les cases au bureau.
  libelleChoix: string;
  // Case « Tous » en tête, qui coche / décoche l'ensemble — utile quand les
  // choix sont nombreux et qu'on veut n'en garder qu'un.
  tous?: { coche: boolean; basculer: () => void };
  choix: ChoixCase[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef<HTMLSpanElement>(null);
  const visible = ouvert && actif;
  useEffect(() => {
    if (!visible) return;
    const onDown = (e: MouseEvent) => {
      if (ancre.current && !ancre.current.contains(e.target as Node)) setOuvert(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [visible]);

  const cases = (grisees: boolean) => (
    <div className={`flex flex-col gap-1.5 ${grisees ? 'opacity-50' : ''}`}>
      {tous && (
        <Case checked={tous.coche} disabled={grisees} onChange={tous.basculer} libelle="Tous" />
      )}
      {choix.map((c) => (
        <Case key={c.cle} checked={c.coche} disabled={grisees} onChange={c.basculer} libelle={c.libelle} />
      ))}
    </div>
  );

  return (
    <div className={large ? 'flex w-full flex-col gap-2' : 'flex items-center gap-1'}>
      <Bouton
        onClick={onBascule}
        disabled={disabled}
        actif={actif}
        taille="sm"
        pleineLargeur={large}
        title={title}
        icone={icone}
        libelle={libelle}
      />
      {large ? (
        cases(!actif)
      ) : (
        <span ref={ancre} className="relative inline-flex flex-none">
          <BoutonIcone
            onClick={() => setOuvert((v) => !v)}
            disabled={!actif}
            actif={visible}
            aria-expanded={visible}
            cadre
            icone={<ChevronDown size={14} />}
            libelle={libelleChoix}
          />
          <FlottantAuto
            ouvert={visible}
            ancre={ancre}
            largeur={240}
            hauteur={(choix.length + (tous ? 1 : 0)) * 26 + 32}
            rembourrage="md"
          >
            {cases(false)}
          </FlottantAuto>
        </span>
      )}
    </div>
  );
}

export default function RunesOptim({
  runes,
  crafts,
  usedRuneIds,
  runeMarkerLabels,
  menuOuvert,
  onFermerMenu,
}: Props) {
  const [threshold, setThreshold] = useStickyState('optim.threshold', 100);
  const metric = useRuneMetric(); // réglage global : efficience ou score SW
  const [sort, setSort] = useStickyState<SortMode>('optim.sort', 'effCur');
  // Sens du tri — le même axe que dans la Liste, le même bouton (voir lib/tri.ts).
  const [sens, setSens] = useStickyState<SensTri>('optim.sens', SENS_PAR_DEFAUT);
  const [gemMode, setGemMode] = useStickyState<'gem' | 'grind'>('optim.gemMode', 'gem');
  // « Autoriser un regemme différent » — éteint par défaut : la stat d'une rune
  // DÉJÀ gemmée reste celle choisie par le joueur (choix produit, voir
  // runeOptim.ts). Allumé, sa ligne gemmée peut passer à une autre stat.
  const [regemLibre, setRegemLibre] = useStickyState('optim.regemLibre', false);
  // Antiques : elles ont leurs propres tables de max, donc un potentiel qui ne
  // se compare pas aux runes normales — pouvoir les écarter (ou n'avoir qu'elles)
  // évite de mélanger deux échelles dans un même classement.
  const [ancientBrut, setAncient] = useStickyState<AncientFilterValue>('optim.ancient', 'all');
  const ancient = normFiltreAntique(ancientBrut);
  // Liste blanche, tout coché par défaut (voir RunesList) : coché = affiché,
  // aucun coché = rien.
  const [sets, setSets] = useStickyState<Set<string>>('optim.sets', new Set(runes.map((r) => r.set)));
  const [slots, setSlots] = useStickyState<Set<number>>('optim.slots', new Set([1, 2, 3, 4, 5, 6]));
  // Marqueurs posés en jeu (voir `RuneDetail.marker`). MÊME grammaire que
  // « Runes utilisées » : un bouton qui allume le filtre, et des cases pour
  // choisir ce qu'il garde.
  //
  // ⚠️ **On retient ce qui est EXCLU**, pas ce qui est coché — à l'inverse des
  // périmètres : un marqueur qui apparaît au réimport suivant doit arriver
  // coché, pas décoché en silence. Vide = tout coché, le défaut.
  const [marqueursActif, setMarqueursActif] = useStickyState('optim.markersOnly', false);
  const [marqueursExclus, setMarqueursExclus] = useStickyState<Set<number>>(
    'optim.marqueursExclus',
    new Set()
  );
  // Les choix proposés, avec leur nombre de runes : les marqueurs réellement
  // posés dans l'inventaire, puis « Sans marqueur ». Proposer un marqueur que ne
  // porte aucune rune ne filtre rien.
  const choixMarqueurs = useMemo(() => {
    const compte = new Map<number, number>();
    let sans = 0;
    for (const r of runes) {
      if (r.marker === undefined) sans++;
      else compte.set(r.marker, (compte.get(r.marker) ?? 0) + 1);
    }
    if (compte.size === 0) return [];
    return [
      ...Array.from(compte.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([k, n]) => ({ k, n })),
      { k: SANS_MARQUEUR, n: sans },
    ];
  }, [runes]);
  // ⚠️ Masqué quand aucune rune n'est marquée (export sans marqueurs) : un
  // filtre qui ne peut rien retirer n'aide personne — plutôt que grisé,
  // puisqu'aucun réimport ne le rendrait utile. Un compte conservé avant la
  // lecture des marqueurs n'arrive pas jusqu'ici (`ACCOUNT_SCHEMA` 7).
  const marqueursDispo = choixMarqueurs.length > 0;
  const filtreMarqueurs = marqueursActif && marqueursDispo;
  // Une exclusion qui ne vise aucun choix présent (marqueur retiré en jeu
  // depuis) ne compte pas : elle ne retire rien.
  const nbMarqueursExclus = filtreMarqueurs
    ? choixMarqueurs.filter((c) => marqueursExclus.has(c.k)).length
    : 0;
  const libelleMarqueur = (k: number) =>
    k === SANS_MARQUEUR ? 'Sans marqueur' : runeMarkerLabels[k] ?? `Marqueur ${k}`;
  const [page, setPage] = useState(0);
  // Changer un filtre ramène à la première page.
  const choisirSets = (next: Set<string>) => {
    setSets(next);
    setPage(0);
  };
  const choisirSlots = (next: Set<number>) => {
    setSlots(next);
    setPage(0);
  };
  const [openId, setOpenId] = useState<number | null>(null);
  const toggleOpen = useCallback((id: number) => setOpenId((c) => (c === id ? null : id)), []);
  const withGem = gemMode === 'gem';
  // Sous `lg`, la grille passe à DEUX colonnes fixes et les tuiles au rendu
  // resserré. ⚠️ Lu ICI une seule fois et passé aux tuiles : la liste en rend
  // jusqu'à soixante, un `useMediaQuery` par tuile poserait soixante écouteurs
  // `matchMedia` pour une seule et même réponse. Même patron que RunesList.
  const etroit = useMediaQuery(SOUS_LG);

  // ⚠️ **Les immémoriaux se mettent DE CÔTÉ, ils ne se comptent pas à part.**
  // Une gemme ou une meule immémoriale va sur n'importe quel set : c'est le
  // consommable le plus rare et le plus précieux du compte, celui qu'on garde
  // pour la rune qui le méritera. Tant qu'il entrait dans la réserve, une rune
  // annoncée « faisable » pouvait ne l'être qu'au prix de cette pièce-là — et
  // rien ne le disait. Exclure ces lignes revient exactement à répondre « et
  // sans y toucher, qu'est-ce qui reste faisable ? ».
  //
  // ⚠️ **Un filtre de la RÉSERVE, pas du calcul** : on retire les lignes en
  // amont de `buildCraftStock` plutôt que d'ajouter un paramètre à `ownsCraft`
  // et à `pickCraft`. Une réserve sans immémoriaux EST une réserve — la même
  // règle de choix s'y applique, et il n'y a pas deux façons de décider ce qui
  // est disponible (voir crafts.ts, « la MÊME règle décide de la faisabilité et
  // de ce qu'on décompte »).
  const [sansImmemoriaux, setSansImmemoriaux] = useStickyState('optim.sansImmemoriaux', false);
  // `setKey === null` = immémorial (voir CraftLine) : utilisable sur tous les sets.
  const lignesReserve = useMemo(
    () => (sansImmemoriaux ? crafts.filter((l) => l.setKey !== null) : crafts),
    [crafts, sansImmemoriaux]
  );
  const stock = useMemo(
    () => (lignesReserve.length ? buildCraftStock(lignesReserve) : EMPTY_STOCK),
    [lignesReserve]
  );
  const stockDispo = stock.total > 0;
  // ⚠️ Distinct de `stockDispo` : une réserve a bien été lue, mais le filtre
  // ci-dessus a pu la vider entièrement. Sans cette nuance, le bouton
  // « Faisable » se grisait en accusant l'import — « réimporte ton compte » —
  // alors que c'est un filtre de l'écran qui venait de tout retirer.
  const reserveLue = crafts.length > 0;
  // ⚠️ **Un filtre de plus, pas un onglet de plus.** « Ce que je peux faire
  // maintenant » est la même liste, restreinte : le potentiel héroïque, le
  // potentiel légendaire et les deux gains restent affichés et triables. En
  // faire une vue séparée obligeait à y réimplémenter tout ça.
  const [checkStock, setCheckStock] = useStickyState('optim.checkStock', false);
  const verifie = checkStock && stockDispo;

  // « Runes utilisées » — MÊME principe que « Faisable avec ma réserve » : un
  // filtre de plus, pas un onglet de plus. Un compte de 3 000 runes en fait
  // jouer trois cents ; les autres dorment dans le sac, et améliorer l'une
  // d'elles ne change rien à aucun combat. Le potentiel, les gains et les tris
  // restent exactement les mêmes.
  //
  // Les PÉRIMÈTRES (RTA, siège, arène, autres decks) se choisissent : liste
  // blanche, les six cochés par défaut — c'est la définition historique du
  // filtre, qui ne change donc pas tant qu'on n'y touche pas. Une rune compte
  // dès qu'UN périmètre coché la contient (union).
  const [perimetres, setPerimetres] = useStickyState<Set<PerimetreUtilise>>(
    'optim.usedScopes',
    new Set(PERIMETRES_UTILISES.map((p) => p.key))
  );
  const utilisees = useMemo(
    () => new Set(unionRunesUtilisees(usedRuneIds, perimetres)),
    [usedRuneIds, perimetres]
  );
  const tousPerimetres = PERIMETRES_UTILISES.every((p) => perimetres.has(p.key));
  // ⚠️ Un export sans aucun deck enregistré n'a rien à proposer : le bouton est
  // alors DÉSACTIVÉ et dit pourquoi, plutôt que de vider la liste sans
  // explication (même règle que la réserve de meules). Jugé sur TOUS les
  // périmètres, pas sur ceux cochés : décocher tout n'est pas « aucun deck lu ».
  const utiliseesDispo = PERIMETRES_UTILISES.some((p) => usedRuneIds[p.key].length > 0);
  const [usedOnly, setUsedOnly] = useStickyState('optim.usedOnly', false);
  const filtreUtilisees = usedOnly && utiliseesDispo;
  const basculerPerimetre = (k: PerimetreUtilise) => {
    const next = new Set(perimetres);
    next.has(k) ? next.delete(k) : next.add(k);
    setPerimetres(next);
    setPage(0);
  };
  const basculerMarqueur = (k: number) => {
    const next = new Set(marqueursExclus);
    next.has(k) ? next.delete(k) : next.add(k);
    setMarqueursExclus(next);
    setPage(0);
  };
  const scenario = scenarioOf(sort);

  // Potentiel calculé une fois par import (linéaire, mémoïsé).
  //
  // ⚠️ Sous le filtre, le calcul change deux fois :
  //  - `noDowngrade` : on ne redescend jamais une meule déjà posée ;
  //  - `dispo` : **seules les stats dont le consommable est en réserve** sont
  //    poussées.
  //
  // Exiger le plan COMPLET écartait des runes parfaitement travaillables : une
  // Swift dont trois substats sur quatre étaient meulables disparaissait parce
  // qu'il manquait la meule VIT. Le gain affiché est donc celui qu'on peut
  // vraiment aller chercher aujourd'hui, ni plus ni moins.
  //
  // ⚠️ **Chaque chiffre contre la réserve de SON grade** (`dispoReserve`) : le
  // potentiel héroïque d'une tuile contre les consommables héroïques ou mieux,
  // le légendaire contre les légendaires — quel que soit le tri. Une seule
  // réserve, celle du grade du tri, surestimait le chiffre légendaire (trié en
  // héroïque, une meule héroïque y passait pour légendaire) et sous-estimait
  // l'héroïque (trié autrement, une meule héroïque présente était refusée).
  // Le tri ne choisit plus que le grade du FILTRE et du PLAN, plus bas.
  const rows = useMemo(
    () =>
      runes.map(
        (rune, id): OptimRow => ({
          rune,
          id,
          pot: runePotential(
            rune,
            withGem,
            metric,
            verifie,
            verifie
              ? { hero: dispoReserve(stock, rune, 'hero'), legend: dispoReserve(stock, rune, 'legend') }
              : undefined,
            regemLibre
          ),
        })
      ),
    [runes, withGem, metric, verifie, stock, regemLibre]
  );

  // Une rune est retenue si le plan **restreint à la réserve** apporte encore
  // quelque chose. Plus de confrontation à faire : le plan ne contient déjà que
  // du réalisable.
  const faisable = useMemo(() => {
    if (!verifie) return null;
    const ok = new Set<number>();
    for (const r of rows) {
      const plan = runePlan(r.rune, scenario, withGem, metric, true, dispoReserve(stock, r.rune, scenario), regemLibre);
      if (planNeeds(plan).length > 0 && plan.targetEff > plan.eff) ok.add(r.id);
    }
    return ok;
  }, [verifie, rows, scenario, withGem, metric, stock, regemLibre]);

  // Runes dont l'efficience actuelle dépasse le palier, triées selon le mode choisi.
  const filtered = useMemo(() => {
    const val = SORT_VAL[sort];
    const signe = signeTri(sens);
    return rows
      .filter(
        (r) =>
          r.pot.eff >= threshold &&
          keepAncient(r.rune, ancient) &&
          (!filtreUtilisees || utilisees.has(r.rune.id)) &&
          sets.has(r.rune.set) &&
          slots.has(r.rune.slot) &&
          (!filtreMarqueurs || !marqueursExclus.has(r.rune.marker ?? SANS_MARQUEUR)) &&
          (!faisable || faisable.has(r.id))
      )
      .sort((a, b) => signe * (val(b.pot) - val(a.pot)));
  }, [
    rows,
    threshold,
    sort,
    ancient,
    sets,
    slots,
    filtreMarqueurs,
    marqueursExclus,
    faisable,
    filtreUtilisees,
    utilisees,
    sens,
  ]);

  // ⚠️ Le palier est exprimé DANS la mesure courante : « 100 » ne veut pas dire
  // la même chose en efficience et en score. Changer de mesure sans convertir
  // laissait un palier qui coupe ailleurs sans prévenir — souvent une liste
  // vide, prise pour un bug.
  //
  // La conversion préserve la SÉLECTION (voir `convertirPalier`), la seule
  // question que le palier pose. Elle ne s'exécute qu'au **changement** de
  // mesure : la recalculer en continu écraserait la valeur qu'on est en train
  // de taper.
  const mesurePrecedente = useRef(metric);
  useEffect(() => {
    const avant = mesurePrecedente.current;
    if (avant === metric) return;
    mesurePrecedente.current = metric;
    if (runes.length === 0) return;
    setThreshold(
      convertirPalier(
        runes.map((r) => ({ avant: runeMetricValue(r, avant), apres: runeMetricValue(r, metric) })),
        threshold
      )
    );
    setPage(0);
  }, [metric, runes, threshold, setThreshold]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  // Les cases des deux filtres « à cases », chacune avec son nombre de runes.
  const choixPerimetres: ChoixCase[] = PERIMETRES_UTILISES.map((p) => ({
    cle: p.key,
    libelle: `${p.libelle} (${usedRuneIds[p.key].length})`,
    coche: perimetres.has(p.key),
    basculer: () => basculerPerimetre(p.key),
  }));
  const choixMarqueursCases: ChoixCase[] = choixMarqueurs.map((c) => ({
    cle: c.k,
    libelle: `${libelleMarqueur(c.k)} (${c.n})`,
    coche: !marqueursExclus.has(c.k),
    basculer: () => basculerMarqueur(c.k),
  }));
  // « Tous » en tête des marqueurs — jusqu'à neuf cases : n'en garder qu'une
  // se fait en décochant tout puis en cochant celle-là.
  const tousMarqueurs = choixMarqueurs.every((c) => !marqueursExclus.has(c.k));

  // Palier, mesure gemme/meule, « Autoriser un regemme différent », filtre
  // antique, « Faisable », « Sans les immémoriaux », « Runes utilisées » et « Marqueurs » — écrits UNE fois,
  // posés à deux endroits : en ligne au bureau, dans le panneau « Options » au
  // doigt (comme les filtres de la Liste). `large` élargit les segmentés à toute
  // la largeur du panneau ; en ligne ils restent serrés.
  // Le MODE du potentiel — ce qui change toute la liste. ⚠️ Au TÉLÉPHONE, il
  // n'est plus dans le panneau « Options » mais en tête de la page (lot 11c,
  // décision 26, la maquette) : on le voit et on le bascule sans ouvrir le
  // panneau. Au bureau, il reste dans la rangée d'options.
  const modeControl = (large: boolean) => (
    <Segmented
      value={gemMode}
      onChange={(k) => {
        setGemMode(k);
        setPage(0);
      }}
      size={large ? 'lg' : undefined}
      options={[
        { key: 'gem', label: 'Gemme + meule', hint: 'Potentiel avec la gemme optimale + les meules' },
        {
          key: 'grind',
          label: 'Meule seule',
          hint: 'Potentiel en gardant les stats actuelles (meules seulement)',
        },
      ]}
    />
  );

  const optionsControls = (large: boolean, avecMode = true) => (
    <>
      <div className="flex items-center gap-2">
        {/* ⚠️ `data-intitule-conserve` : le panneau « Options » masque les
            intitulés de rangée (`[data-tiroir] .label`), redondants avec leurs
            pastilles. Celui-ci ne l'est pas — « 100 % » seul ne dit pas qu'il
            s'agit d'un seuil, là où « Toutes / Antiques » se passent de titre.
            Il reste donc affiché au doigt (voir index.css). */}
        <span className="label" data-intitule-conserve>
          Palier
        </span>
        <NumberField
          value={threshold}
          min={0}
          step={5}
          width="w-14"
          ariaLabel="Palier"
          onChange={(v) => {
            setThreshold(Math.max(0, v ?? 0));
            setPage(0);
          }}
        />
        <span className="font-mono text-xs text-ink-dim">{metric === 'eff' ? '%' : 'pts'}</span>
      </div>

      {avecMode && modeControl(large)}

      {/* Grisé en « Meule seule » : sans gemme, il n'y a rien à regemmer. */}
      <Bouton
        onClick={() => {
          setRegemLibre((v) => !v);
          setPage(0);
        }}
        disabled={!withGem}
        actif={regemLibre}
        taille="sm"
        pleineLargeur={large}
        title={
          withGem
            ? 'Rune déjà gemmée : proposer aussi de regemmer sa ligne gemmée avec une autre stat, absente de la rune'
            : 'Sans objet en « Meule seule » : aucune gemme n’est proposée'
        }
        icone={<Gem size={14} />}
        libelle="Autoriser un regemme différent"
      />

      <div className={large ? 'flex flex-col gap-1' : 'flex items-center gap-2'}>
        <span className="label">Runes</span>
        <AncientFilter
          value={ancient}
          onChange={(k) => {
            setAncient(k);
            setPage(0);
          }}
          size={large ? 'lg' : undefined}
        />
      </div>

      {/* ⚠️ Un potentiel de +20 ne vaut rien si la meule qui l'apporte n'est pas
          dans le sac. Ce bouton restreint la liste à ce qui est applicable **ce
          soir**, sans rien retirer des colonnes. Désactivé sans réserve connue
          (compte importé avant cette version) : un bouton qui viderait la liste
          sans explication vaut moins qu'un bouton grisé qui dit pourquoi. */}
      {/* ⚠️ **Pleine largeur au DOIGT seulement.** Dans le panneau « Options »,
          les segmentés au-dessus prennent toute la largeur (`lg`) ; un bouton à
          la largeur de son texte pendait, seul et à gauche, sous des contrôles
          pleins. Il reprend donc la largeur de la colonne, comme eux. Au BUREAU
          (`large` faux), il reste serré dans la rangée en ligne. */}
      <Bouton
        onClick={() => {
          setCheckStock((v) => !v);
          setPage(0);
        }}
        disabled={!stockDispo}
        actif={verifie}
        taille="sm"
        pleineLargeur={large}
        title={
          stockDispo
            ? `Ne garder que les runes applicables avec tes ${stock.total} meules et gemmes en réserve`
            : reserveLue
              ? 'Ta réserve ne contient que des immémoriaux, que le filtre voisin met de côté'
              : 'Aucune meule ni gemme dans les données chargées — réimporte ton compte'
        }
        icone={<PackageCheck size={14} />}
        libelle="Faisable avec ma réserve"
      />

      {/* ⚠️ Utile MÊME quand « Faisable » est éteint : le marquage vert/grisé
          des marteaux et des gemmes du plan lit la même réserve. Le bouton
          n'est donc pas asservi au précédent — il n'est grisé que si aucune
          réserve n'a été lue, où il n'aurait rien à retirer. */}
      <Bouton
        onClick={() => {
          setSansImmemoriaux((v) => !v);
          setPage(0);
        }}
        disabled={!reserveLue}
        actif={sansImmemoriaux}
        taille="sm"
        pleineLargeur={large}
        title={
          reserveLue
            ? 'Garder tes gemmes et meules immémoriales de côté : elles vont sur tous les sets, elles ne se remplacent pas'
            : 'Aucune meule ni gemme dans les données chargées — réimporte ton compte'
        }
        icone={<Lock size={14} />}
        libelle="Sans les immémoriaux"
      />

      {/* ⚠️ Au DOIGT, côte à côte sur deux colonnes : empilés, bouton + six
          cases + bouton + neuf cases faisaient défiler le panneau sur plus d'un
          écran. `w-full` : le panneau aligne ses `.flex-col` à gauche, la
          grille ne prendrait sinon que la largeur de son contenu. Une seule
          colonne s'il n'y a pas de marqueurs — « Runes utilisées » ne se
          réduit pas à une demi-largeur pour rien. `items-start` : les deux
          listes n'ont pas la même hauteur. */}
      {large ? (
        <div className={`grid w-full items-start gap-3 ${marqueursDispo ? 'grid-cols-2' : ''}`}>
          {filtresACases(true)}
        </div>
      ) : (
        filtresACases(false)
      )}
    </>
  );

  // « Runes utilisées » et « Marqueurs » : deux filtres À CASES, même gabarit
  // (voir `FiltreACases`).
  const filtresACases = (large: boolean) => (
    <>
      <FiltreACases
        large={large}
        actif={filtreUtilisees}
        disabled={!utiliseesDispo}
        onBascule={() => {
          setUsedOnly((v) => !v);
          setPage(0);
        }}
        title={
          utiliseesDispo
            ? `Ne garder que les ${utilisees.size} runes qui jouent dans les périmètres cochés`
            : 'Aucun deck lu dans les données chargées — réimporte ton compte'
        }
        icone={<Swords size={14} />}
        libelle="Runes utilisées"
        libelleChoix="Choisir les périmètres des runes utilisées"
        choix={choixPerimetres}
      />

      {marqueursDispo && (
        <FiltreACases
          large={large}
          actif={filtreMarqueurs}
          onBascule={() => {
            setMarqueursActif((v) => !v);
            setPage(0);
          }}
          title="Ne garder que les runes des marqueurs cochés"
          icone={<Tag size={14} />}
          libelle="Marqueurs"
          libelleChoix="Choisir les marqueurs"
          tous={{
            coche: tousMarqueurs,
            basculer: () => {
              setMarqueursExclus(tousMarqueurs ? new Set(choixMarqueurs.map((c) => c.k)) : new Set());
              setPage(0);
            },
          }}
          choix={choixMarqueursCases}
        />
      )}
    </>
  );

  return (
    <div>
      {/* ⚠️ **En-tête à la SOURIS** (refonte graphique, lot 8a-3, la maquette) :
          le titre de la vue et ce qu'elle cherche. Au doigt, la barre du haut
          dit déjà la vue (lot 11). */}
      <div className="mb-3 hidden items-baseline gap-3 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">Optimisation</h1>
        <span className="text-sm text-ink-dim">
          Ce que tes meules et gemmes permettent d'améliorer, rune par rune.
        </span>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn">
        <AlertTriangle size={15} className="flex-none mt-0.5" />
        <span>
          Ceci est une optimisation d'<b>efficience</b> : ce n'est pas toujours la bonne solution pour tes
          runes (la stat la plus efficiente n'est pas forcément celle utile à ton monstre).
        </span>
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        {/* Au DOIGT : le MODE en tête, sur toute la largeur (décision 26). */}
        <div className="w-full lg:hidden">{modeControl(true)}</div>
        {/* Au DOIGT : les rangées d'avant (`contents` : leurs enfants restent
            des éléments de la rangée), cachées à la souris (lot 11). */}
        <div className="contents lg:hidden">
          <SetFilter runes={runes} value={sets} onChange={choisirSets} />
          <SlotFilter value={slots} onChange={choisirSlots} />
        </div>
        {/* À la SOURIS : les menus déroulants (lot 8a, décision 20). Sans
            « Antiques » : l'Optimisation les range avec « Faisable avec ma
            réserve », dans ses options, plus loin sur la rangée. */}
        <div className="hidden lg:block">
          <FiltresRunes
            runes={runes}
            sets={sets}
            onSets={choisirSets}
            slots={slots}
            onSlots={choisirSlots}
            ancient={ancient}
            onAncient={setAncient}
            antiques={false}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="label">Trier par</span>
          {/* Au DOIGT : la liste déroulante (lot 11). */}
          <Selecteur
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortMode);
              setPage(0);
            }}
            pleineLargeur={false}
            className="lg:hidden"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Selecteur>
          {/* À la SOURIS, des onglets (`Segmented`), comme le reste de la
              page (le mainteneur, lot 8a). Mêmes entrées, même ordre. */}
          <div className="hidden lg:block">
            <Segmented
              value={sort}
              onChange={(v) => {
                setSort(v);
                setPage(0);
              }}
              options={SORTS.map((s) => ({ key: s.key, label: s.label }))}
            />
          </div>
          <BoutonSensTri
            sens={sens}
            onChange={(v) => {
              setSens(v);
              setPage(0);
            }}
          />
        </div>

        {/* Palier, mesure gemme/meule, « Autoriser un regemme différent »,
            filtre antique, « Faisable avec ma réserve », « Sans les immémoriaux », « Runes utilisées » et
            « Marqueurs » : au BUREAU en ligne ici, sur TÉLÉPHONE dans le panneau
            « Options » (bouton de la barre de nav, voir la fin du composant).

            ⚠️ **`flex-wrap`, comme la rangée qui le contient.** Ce groupe est
            UN seul élément de la rangée parente : sans retour à la ligne
            interne, il ne peut pas se réduire sous la largeur de ses huit
            contrôles et c'est la PAGE qui déborde par la droite — la rangée
            parente, elle, n'a rien à passer à la ligne, elle ne voit qu'un
            bloc. Le `gap-y` sépare les lignes ainsi créées. */}
        <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
          {optionsControls(false)}
        </div>

        {/* Aide : « ? » sur la même ligne, à droite */}
        <div className="ml-auto">
          <HelpPopover title="Comment est-ce calculé ?" width={360}>
              <p>
                Pour chaque rune on calcule son <b className="text-ink">efficience actuelle</b> puis son{' '}
                <b className="text-ink">potentiel maximal</b>, en héroïque et en légendaire (tables distinctes
                pour les runes antiques), selon le mode :
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <b className="text-ink">Gemme + meule</b> — meilleure gemme possible <i>puis</i> toutes les
                  meules poussées au max.
                </li>
                <li>
                  <b className="text-ink">Meule seule</b> — on garde les stats actuelles et on ne pousse que
                  les meules, pour repérer les runes à grinder en priorité.
                </li>
              </ul>
              <p className="mt-2">
                <span className="text-ink font-semibold">Choix de la gemme</span> : si la rune n'est pas
                gemmée, on prend la stat grindable la plus rentable (PV%/ATQ%/DEF%/VIT, sinon un flat), sans
                doublon et en respectant les emplacements (slot 1 sans DEF, slot 3 sans ATQ) — la stat de la
                ligne elle-même compte (une ATQ% faible peut être regemmée en ATQ%). Si elle est déjà gemmée, on
                garde la stat que tu as choisie : on ne fait que la « procker » au max — sauf avec{' '}
                <b className="text-ink">Autoriser un regemme différent</b>, qui propose aussi de la remplacer
                par une autre stat absente de la rune (seule la ligne déjà gemmée peut l'être).
              </p>
              <p className="mt-2">
                <span className="text-ink font-semibold">Gain</span> = potentiel − efficience actuelle : ce
                que la rune gagnerait. Sur chaque carte, sa ligne garde la couleur de la rareté visée ;
                dans le détail d'une rune, il est en <span className="text-good">vert</span> s'il est
                positif, en <span className="text-bad">rouge</span> s'il est négatif (ex. une rune déjà
                grindée légendaire « perd » en héroïque — ce cas disparaît sous « Faisable avec ma
                réserve »).
              </p>
              <p className="mt-2">
                <b className="text-ink">Tri</b> : efficience actuelle, potentiel ou gain. Clique une rune pour
                voir le plan <b className="text-ink">avant / après</b>.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Palier</span> : n'affiche que les runes dont la{' '}
                <b className="text-ink">valeur actuelle</b> atteint ce seuil — pas le potentiel, ni le gain.
                Une rune médiocre a souvent le plus gros gain relatif, sans devenir bonne pour autant.
              </p>
              <p className="mt-1.5">
                Il est exprimé <b className="text-ink">dans la mesure affichée</b> (100 en efficience n'est pas
                100 en score SW). En changeant de mesure dans ⚙, il est{' '}
                <b className="text-ink">reconverti pour garder exactement la même sélection</b> : le nombre de
                runes affichées ne bouge pas, seul le nombre écrit change. Il n'existe pas de facteur entre les
                deux mesures — le rapport varie du simple au double selon la rune — donc la conversion se fait
                par rang, pas par multiplication.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">
                  <Hammer size={12} className="inline mb-0.5" /> et{' '}
                  <Gem size={12} className="inline mb-0.5" /> dans le plan
                </span>{' '}
                : chaque ligne à travailler porte l'icône de ce qu'elle réclame — un marteau pour une{' '}
                <b className="text-ink">meule</b>, une gemme pour une <b className="text-ink">gemme</b>.
              </p>
              <ul className="mt-1.5 space-y-1">
                <li>
                  <Hammer size={12} className="inline mb-0.5 text-good" />{' '}
                  <b className="text-good">vert</b> — tu l'as en réserve, du bon set et au bon grade :
                  c'est posable maintenant.
                </li>
                <li>
                  <Hammer size={12} className="inline mb-0.5 text-ink-dim opacity-40" />{' '}
                  <b className="text-ink">grisé</b> — il te manque, cette ligne est à farmer.
                </li>
              </ul>
              <p className="mt-1.5">
                Les <b className="text-ink">immémoriaux</b> comptent pour tous les sets ; les consommables{' '}
                <b className="text-ink">antiques</b> ne servent qu'aux runes antiques, et inversement.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Faisable avec ma réserve</span> : ne garde que les
                runes que tu peux améliorer <b className="text-ink">tout de suite</b>. Le calcul change alors —
                il ne pousse que les stats dont tu as le consommable, et ne redescend jamais une meule déjà
                posée. Le gain affiché est donc <b className="text-ink">celui que tu peux réellement aller
                chercher aujourd'hui</b>, pas le potentiel théorique.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Sans les immémoriaux</span> : retire de ta réserve
                les gemmes et meules <b className="text-ink">immémoriales</b> — celles qui vont sur{' '}
                <b className="text-ink">n'importe quel set</b>. Ce sont les plus rares : ce bouton répond à
                « qu'est-ce qui reste faisable <b className="text-ink">sans y toucher</b> ? ». Il change le
                filtre de réserve <i>et</i> les icônes vertes du plan, puisque les deux lisent la même
                réserve.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Runes utilisées</span> : ne garde que les runes qui{' '}
                <b className="text-ink">jouent</b> — posées sur un monstre présent dans un{' '}
                <b className="text-ink">deck</b> (arène, donjons, ToA, siège… <b className="text-ink">tous
                les contenus enregistrés</b>) ou dans un <b className="text-ink">preset RTA</b>. Les presets
                comptent même si la rune dort dans ton inventaire : c'est bien elle qui se pose au combat.
                Le reste de ton stock n'est pas affiché — améliorer une rune que personne ne porte ne change
                aucun combat.
              </p>
              <p className="mt-1.5">
                Tu choisis les <b className="text-ink">périmètres</b> qui comptent (flèche à côté du bouton,
                ou cases sous le bouton dans le panneau « Options ») : RTA, siège en attaque et en défense,
                arène en attaque et en défense, autres decks (donjons, ToA…). Tous sont cochés par défaut ;
                une rune est gardée dès qu'un périmètre coché l'utilise.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Marqueurs</span> : ne garde que les runes des
                marqueurs que tu poses en jeu, avec les noms que tu leur as donnés (un marqueur jamais nommé
                s'affiche par son numéro). Même principe que « Runes utilisées » : le bouton allume le filtre,
                les cases choisissent les marqueurs gardés — tous cochés par défaut. Décoche « Tous » puis
                coche un seul marqueur pour ne garder que lui.
              </p>
          </HelpPopover>
        </div>
      </div>

      {/* AU DOIGT : panneau « Options » (palier, regemme différent, filtre
          antique, « Faisable avec ma réserve », « Sans les immémoriaux »,
          « Runes utilisées », « Marqueurs »). Le bouton qui l'ouvre vit dans la
          barre de nav — voir App.tsx (`pageAPanneau`). Le mode gemme/meule
          (en tête de page au doigt, lot 11c), sets, slots, tri et aide
          restent dans la page. */}
      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre="Options d'optimisation">
        <div className="flex flex-col gap-3">{optionsControls(true, false)}</div>
      </MobileSheet>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-xs text-ink-dim">
          {filtered.length} rune{filtered.length > 1 ? 's' : ''} ≥ {threshold}
          {metric === 'eff' ? '%' : ''}
          {ancient === 'without' && ' · hors antiques'}
          {ancient === 'only' && ' · antiques seules'}
          {verifie && ' · faisables avec ma réserve'}
          {verifie && sansImmemoriaux && ' · sans immémoriaux'}
          {filtreUtilisees && ' · utilisées'}
          {filtreUtilisees &&
            !tousPerimetres &&
            ` (${
              PERIMETRES_UTILISES.filter((p) => perimetres.has(p.key))
                .map((p) => p.libelle)
                .join(', ') || 'aucun périmètre'
            })`}
          {filtreMarqueurs &&
            ` · marqueurs${
              nbMarqueursExclus > 0 ? ` (${nbMarqueursExclus} exclu${nbMarqueursExclus > 1 ? 's' : ''})` : ''
            }`}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* Clé POSITIONNELLE : la tuile est réutilisée d'une page/d'un tri à
          l'autre, donc le cadre de rune pivote vers son nouveau slot (voir SPIN).
          ⚠️ **DEUX grilles, une par format** (comme RunesList) : sous `lg`, DEUX
          colonnes FIXES — l'`auto-fill` à 230 px retombait toujours sur une seule
          colonne sur téléphone, une rune par écran. À partir de `lg`, l'`auto-fill`
          d'origine, inchangé. C'est le rendu `etroit` de la tuile (police et icône
          réduites) qui rend les deux colonnes tenables à ~175 px. */}
      <div
        className="grid grid-cols-2 gap-2 items-start
                   lg:grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))]"
      >
        {shown.map((row, i) => (
          <OptimTile
            key={i}
            row={row}
            scenario={scenario}
            withGem={withGem}
            regemLibre={regemLibre}
            noDowngrade={verifie}
            restreint={verifie}
            stock={stockDispo ? stock : null}
            open={openId === row.id}
            onToggle={toggleOpen}
            etroit={etroit}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-ink-dim text-sm">
          Aucune rune ≥ {threshold}
          {metric === 'eff' ? '%' : ''}
          {ancient !== 'all' && (ancient === 'without' ? ' hors antiques' : ' parmi les antiques')}
          {filtreUtilisees &&
            (perimetres.size === 0 ? ' — aucun périmètre coché pour « Runes utilisées »' : ' parmi tes runes utilisées')}
          . Baisse le palier
          {ancient !== 'all' ? ' ou repasse sur « Toutes »' : ''}
          {filtreUtilisees ? ' ou désactive « Runes utilisées »' : ''}
          {filtreMarqueurs ? ' ou désactive « Marqueurs »' : ''} pour en voir plus.
        </p>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

export const OptimTile = memo(function OptimTile({
  row,
  scenario,
  withGem,
  regemLibre,
  noDowngrade,
  restreint,
  stock,
  open,
  onToggle,
  etroit = false,
}: {
  row: OptimRow;
  scenario: 'hero' | 'legend';
  withGem: boolean;
  regemLibre: boolean;
  noDowngrade: boolean;
  restreint: boolean; // le plan se limite à ce que la réserve permet
  stock: CraftStock | null;
  open: boolean;
  onToggle: (id: number) => void;
  // Rendu resserré des DEUX colonnes sur téléphone : police et icône réduites
  // pour que la tuile tienne à ~175 px. Lu une fois par la liste, passé ici (voir
  // RunesOptim). Ne touche QUE la tuile fermée — le plan ouvert (FlottantAuto)
  // garde sa taille.
  etroit?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { rune, pot } = row;
  const ancient = rune.rank > 10;
  const metric = useRuneMetric();
  const fmt = (v: number) => formatRuneMetric(v, metric);

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-accent' : 'border-border'}`}
    >
      <button
        onClick={() => onToggle(row.id)}
        className={`w-full flex items-center text-left ${etroit ? 'gap-1.5 p-1.5' : 'gap-2.5 p-2'}`}
      >
        {/* ⚠️ 34 px en resserré, 46 ailleurs. À deux colonnes le cadre de rune est
            le dernier poste de largeur ; pas sous 30 px, sinon le symbole de set
            gravé cesse de se reconnaître (voir RunesList). */}
        <RuneSlotIcon
          slot={rune.slot}
          setKey={rune.set}
          rarity={rune.rarity}
          ancient={ancient}
          height={etroit ? 34 : 46}
        />
        <div className="min-w-0 flex-1">
          <div className={`font-bold text-ink leading-tight truncate ${etroit ? 'text-nano' : 'text-xs'}`}>
            {formatRuneEffect(rune.main)}
          </div>
          <div className={`font-mono text-accent leading-tight ${etroit ? 'text-nano' : 'text-xs'}`}>
            {/* ⚠️ Toute la ligne en BRAISE (`text-accent`, donc la braise
                lisible), mot compris — une couleur par ligne, comme « Héro » et
                « Légend ». Choisie par le mainteneur sur planche (rebranding R8 ;
                essayés : encre, bleu ciel, vert). Dans la couleur de la rareté
                (`meta.ink`), la valeur se confondait avec la ligne de même
                rareté juste dessous — violette comme « Héro » sur une rune
                héroïque, orange près de l'or de « Légend » sur une légendaire. */}
            actuelle <b>{fmt(pot.eff)}</b>
          </div>
          <div
            className={`font-mono leading-tight ${etroit ? 'text-nano' : 'text-micro'}`}
            style={{ color: 'rgb(var(--rarity-4))' }}
          >
            {/* ⚠️ UNE couleur par ligne, celle de sa rareté (le mainteneur, rebranding
                R8) : la flèche et la valeur cible suivaient le vert / rouge du
                gain, et la ligne « Héro » se lisait en deux couleurs. Le signe du
                gain dit déjà s'il monte ou descend ; le vert / rouge reste dans
                le plan détaillé (`OptimPlanBox`). */}
            Héro {signed(pot.heroGain, metric)} → {fmt(pot.heroEff)}
          </div>
          <div className={`font-mono leading-tight font-bold text-star ${etroit ? 'text-nano' : 'text-micro'}`}>
            Légend {signed(pot.legendGain, metric)}{' '}
            <span className="font-normal">→ {fmt(pot.legendEff)}</span>
          </div>
        </div>
      </button>

      {/* ⚠️ `rembourrage="md"` : le flottant pose bord + fond + coins arrondis,
          `OptimPlanBox` n'a plus les siens (voir plus bas) — sinon carte dans
          une carte, à deux rayons de coin différents. Même règle que
          `DesyncBadge` et le détail d'une pièce équipée (PieceDetail.tsx).
          ⚠️ La popup reste ANCRÉE à la tuile aux deux formats : `FlottantAuto`
          se cale dans l'écran (voir son clamp horizontal) au lieu de déborder —
          sur la grille à deux colonnes du téléphone, une tuile de ~170 px ne
          laissait sinon pas la place à ses 340 px. */}
      <FlottantAuto ouvert={open} ancre={ref} hauteur={300} largeur={340} rembourrage="md">
        <OptimPlanBox
          rune={rune}
          scenario={scenario}
          withGem={withGem}
          regemLibre={regemLibre}
          noDowngrade={noDowngrade}
          restreint={restreint}
          stock={stock}
        />
      </FlottantAuto>
    </div>
  );
});

// Le violet qui signale « ce qui change » dans un plan d'optimisation. Même
// teinte que l'héroïque, donc même token : il suit le thème et reste lisible
// sur fond clair. Voir docs/03-developpeur/interface/.
const VIOLET = 'rgb(var(--rarity-4))';

// Ligne de substat façon carte de jeu : base + grind + ↻. Chaque partie peut
// être mise en violet indépendamment (seul ce qui change passe en violet).
function SubLine({
  code,
  base,
  grind,
  enchant,
  baseViolet,
  grindViolet,
  enReserve,
}: {
  code: number;
  base: number;
  grind: number;
  enchant?: boolean;
  baseViolet?: boolean;
  grindViolet?: boolean;
  // `null` = rien à poser sur cette ligne, ou réserve inconnue → aucun marquage.
  enReserve?: { kind: 'grind' | 'gem'; ok: boolean } | null;
}) {
  const def = RUNE_EFFECT[code];
  const label = def ? (def.label.endsWith('%') ? def.label.slice(0, -1) : def.label) : `#${code}`;
  const suffix = def?.suffix ?? '';
  return (
    <div className="flex items-center gap-1 leading-tight">
      <span
        className={baseViolet ? 'font-semibold' : 'text-ink'}
        style={baseViolet ? { color: VIOLET } : undefined}
      >
        {label} {base}
        {suffix}
      </span>
      {grind > 0 && (
        <span
          className={grindViolet ? 'font-semibold' : 'text-orange-400'}
          style={grindViolet ? { color: VIOLET } : undefined}
        >
          +{grind}
          {suffix}
        </span>
      )}
      {enchant && (
        <RotateCw
          size={11}
          className={baseViolet ? '' : 'text-orange-400'}
          style={baseViolet ? { color: VIOLET } : undefined}
        />
      )}
      {/* ⚠️ La ligne qu'on peut poser TOUT DE SUITE est marquée. L'icône dit de
          quel consommable il s'agit, la couleur dit s'il est en réserve : vert
          = disponible, grisé = à farmer. Sans ce repère, il fallait aller
          compter ses meules ailleurs pour savoir par où commencer. */}
      {enReserve &&
        (enReserve.kind === 'grind' ? (
          <Hammer
            size={10}
            className={`ml-auto flex-none ${enReserve.ok ? 'text-good' : 'text-ink-dim opacity-40'}`}
          />
        ) : (
          <Gem
            size={10}
            className={`ml-auto flex-none ${enReserve.ok ? 'text-good' : 'text-ink-dim opacity-40'}`}
          />
        ))}
    </div>
  );
}

// Détail « Actuel | Optimisé » : la rune telle quelle à gauche, sa version
// optimisée à droite avec le(s) changement(s) (gemme/grind) en violet.
export function OptimPlanBox({
  rune,
  scenario,
  withGem,
  regemLibre = false,
  noDowngrade = false,
  restreint = false,
  stock = null,
}: {
  rune: RuneDetail;
  scenario: 'hero' | 'legend';
  withGem: boolean;
  regemLibre?: boolean;
  noDowngrade?: boolean;
  restreint?: boolean;
  stock?: CraftStock | null;
}) {
  const metric = useRuneMetric();
  // ⚠️ **Quelle ligne puis-je poser MAINTENANT.** Le plan dit quoi faire, la
  // réserve dit ce qui est à portée : sans le croisement, il faut aller compter
  // ses meules ailleurs pour savoir par où commencer.
  // Même règle que la liste (`dispoReserve`) : il n'y en a qu'une.
  const dispo = stock ? dispoReserve(stock, rune, scenario) : () => false;

  // Le plan affiché doit être CELUI du chiffre affiché : sous le filtre, il se
  // limite lui aussi à ce que la réserve permet.
  const plan = runePlan(rune, scenario, withGem, metric, noDowngrade, restreint ? dispo : undefined, regemLibre);
  const gain = plan.targetEff - plan.eff;

  return (
    // Sans cadre : le seul appelant (`RuneCard` ci-dessus) l'affiche dans un
    // `Flottant` qui pose déjà bord + fond + coins arrondis.
    <div className="text-xs">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-bold text-ink uppercase tracking-wide text-micro">
          {scenario === 'legend' ? 'Légendaire' : 'Héroïque'}
        </span>
        <span className="font-mono text-ink-dim text-micro">
          {formatRuneMetric(plan.eff, metric)} →{' '}
          <b className="text-star">{formatRuneMetric(plan.targetEff, metric)}</b>{' '}
          <span className={gain >= 0 ? 'text-good' : 'text-bad'}>({signed(gain, metric)})</span>
        </span>
      </div>

      {/* stat principale + innée (communes aux deux colonnes) */}
      <div className="text-sm font-black text-ink leading-tight">{formatRuneEffect(rune.main)}</div>
      {rune.innate && (
        <div className="text-xs font-semibold text-water leading-tight">{formatRuneEffect(rune.innate)}</div>
      )}

      <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-x-4">
        <div className="label mb-1">Actuel</div>
        <div className="label mb-1">Optimisé</div>

        {/* Colonne gauche : substats actuels */}
        <div className="space-y-1">
          {plan.subs.map((s, i) => (
            <SubLine
              key={i}
              code={s.fromCode}
              base={s.curTotal - s.curGrind}
              grind={s.curGrind}
              enchant={rune.subs[i]?.enchant}
            />
          ))}
        </div>

        {/* Colonne droite : substats optimisés (seul ce qui change en violet) */}
        <div className="space-y-1">
          {plan.subs.map((s, i) => {
            // Une seule marque par ligne : la gemme prime, c'est elle qui
            // conditionne le reste (elle remet la meule du slot à zéro).
            const marque = s.isGem
              ? { kind: 'gem' as const, ok: dispo('gem', s.code) }
              : s.grindable && s.grind > s.curGrind
                ? { kind: 'grind' as const, ok: dispo('grind', s.code) }
                : null;
            return (
              <SubLine
                key={i}
                code={s.code}
                base={s.base}
                grind={s.grind}
                enchant={s.isGem || rune.subs[i]?.enchant}
                baseViolet={s.isGem} // la stat/base ne change qu'à la gemme
                grindViolet={s.isGem || s.grind !== s.curGrind}
                enReserve={stock ? marque : null}
              />
            );
          })}
        </div>
      </div>

      {/* ⚠️ **Déclarer ce qu'on vient de faire en jeu**, sans réexporter son
          compte. Un export est une photo : dès qu'on meule, la réserve affichée
          est fausse et l'app propose des runes qu'on n'a plus de quoi traiter.
          Ce bouton retire les consommables du stock **et** la rune de la liste.
          Réversible : « Annuler » remet tout, une ligne cliquée par erreur ne
          doit pas obliger à réimporter. */}
    </div>
  );
}
