import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { RuneDetail } from '../../types';
import { runePotential } from '../../lib/runeOptim';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import SetFilter from './SetFilter';
import NumberField from '../../ui/NumberField';
import Pastille from '../../ui/Pastille';
import Bouton from '../../ui/Bouton';
import Segmented from '../Segmented';
import SlotFilter from './SlotFilter';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';
import MobileSheet from '../../ui/MobileSheet';
import { BoutonIcone, FlottantAuto } from '../../ui';
import { useMediaQuery, SOUS_LG } from '../../hooks/useMediaQuery';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400; // nb de runes affichées par défaut
const HERO_COLOR = '#c88cff'; // Potentiel héroïque → violet
const LEGEND_COLOR = '#f8b24a'; // Potentiel légendaire → orange

export default function RunesCurve({ runes }: Props) {
  // Liste blanche, tout coché par défaut (voir RunesList) : un set/slot coché est
  // affiché, aucun coché = rien.
  const [sets, setSets] = useStickyState<Set<string>>('runesCurve.sets', new Set(runes.map((r) => r.set)));
  const [slots, setSlots] = useStickyState<Set<number>>('runesCurve.slots', new Set([1, 2, 3, 4, 5, 6]));
  const [ancientOnly, setAncientOnly] = useStickyState('runesCurve.ancient', false);
  const [limit, setLimit] = useStickyState('runesCurve.limit', DEFAULT_LIMIT);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCurve.hidden', new Set());
  const [gemMode, setGemMode] = useStickyState<'gem' | 'grind'>('runesCurve.gemMode', 'gem');
  const metric = useRuneMetric(); // réglage global : efficience ou score SW
  const [showHelp, setShowHelp] = useState(false);
  // ⚠️ **Deux supports pour la même aide.** Ce texte fait une demi-page :
  // ancré à un bouton de 28 px, il descendait sous le bas de l'écran et ses
  // dernières lignes passaient derrière la barre d'onglets. Le plafonner et le
  // faire défiler n'a pas suffi — un pavé de texte dans une bulle flottante
  // reste illisible sur un téléphone. Sous `lg` il devient donc un PANNEAU
  // MONTANT, le composant que l'app emploie partout ailleurs pour ça.
  const auDoigt = useMediaQuery(SOUS_LG);
  const helpRef = useRef<HTMLDivElement>(null);
  const withGem = gemMode === 'gem';

  // Ferme la popup d'aide au clic à l'extérieur.
  // ⚠️ Popover SEULEMENT : le panneau montant a son propre voile et sa croix,
  // et cet écouteur l'aurait refermé au premier appui à l'intérieur.
  useEffect(() => {
    if (!showHelp || auDoigt) return;
    const onDown = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showHelp, auDoigt]);

  function toggleHidden(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // Potentiels calculés sur les runes filtrées, puis 3 distributions triées ↓.
  //
  // ⚠️ Chaque distribution garde SA rune à côté de sa valeur : c'est ce qui
  // permet d'ouvrir la rune d'un point du graphe. Les trois sont triées
  // SÉPARÉMENT — le rang N d'« Actuelle » et celui de « Potentiel Légend » ne
  // désignent pas la même rune —, donc chacune transporte son propre ordre.
  const { cur, hero, legend } = useMemo(() => {
    const filtered = runes.filter((r) => {
      if (!sets.has(r.set)) return false;
      if (!slots.has(r.slot)) return false;
      if (ancientOnly && !(r.rank > 10)) return false;
      return true;
    });
    const pots = filtered.map((r) => ({ rune: r, p: runePotential(r, withGem, metric) }));
    // Trie sur une valeur donnée et renvoie valeurs + runes alignées.
    const classe = (val: (p: ReturnType<typeof runePotential>) => number) => {
      const tri = [...pots].sort((a, b) => val(b.p) - val(a.p));
      return { effs: tri.map((t) => val(t.p)), runes: tri.map((t) => t.rune) };
    };
    return {
      cur: classe((p) => p.eff),
      hero: classe((p) => p.heroEff),
      legend: classe((p) => p.legendEff),
    };
  }, [runes, sets, slots, ancientOnly, withGem, metric]);

  const total = cur.effs.length;
  const cap = Math.max(1, limit);
  // Valeurs ET runes bornées ensemble : elles doivent rester alignées.
  const lim = (d: { effs: number[]; runes: RuneDetail[] }) => ({
    effs: d.effs.slice(0, cap),
    runes: d.runes.slice(0, cap),
  });

  // ⚠️ Seule « Actuelle » transporte ses runes : les potentiels ne sont pas
  // d'autres runes, c'est la MÊME box projetée dans une autre hypothèse. Leur
  // donner leurs runes ouvrirait trois cartes quasi identiques pour une seule
  // question — « quelle est cette rune ? ». (En comparaison, c'est l'inverse :
  // chaque courbe est un compte DIFFÉRENT, donc toutes sont ouvrables.)
  const allSeries: CurveSeries[] = [
    { name: 'Actuelle', ...lim(cur), color: OWN_COLOR, own: true },
    { name: 'Potentiel Héro', effs: lim(hero).effs, color: HERO_COLOR, own: false },
    { name: 'Potentiel Légend', effs: lim(legend).effs, color: LEGEND_COLOR, own: false },
  ];
  const visible = allSeries.filter((s) => !hidden.has(s.name));

  // Le texte d'aide, écrit UNE fois pour les deux supports.
  const aide = (
    <>
        <p className="text-ink font-semibold mb-1">À quoi sert ce graphe ?</p>
        <p>
          Il classe toutes tes runes, de la meilleure à la moins bonne :{' '}
          <b className="text-ink">l'efficience (%)</b> en hauteur, le{' '}
          <b className="text-ink">nombre de runes</b> en largeur. Plus les courbes sont{' '}
          <i>hautes et étalées</i>, meilleure est ta box.
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <span style={{ color: OWN_COLOR }}>●</span> <b className="text-ink">Actuelle</b> —
            l'efficience de tes runes aujourd'hui.
          </li>
          <li>
            <span style={{ color: HERO_COLOR }}>●</span> <b className="text-ink">Potentiel Héro</b> — ce
            que deviendrait ta box si chaque rune recevait sa <b className="text-ink">gemme et ses meules
            héroïques optimales</b> <span className="text-ink-dim">(tri « Potentiel héroïque » de l'onglet Optimisation)</span>.
          </li>
          <li>
            <span style={{ color: LEGEND_COLOR }}>●</span> <b className="text-ink">Potentiel Légend</b> —
            la même chose, en <b className="text-ink">légendaire</b>{' '}
            <span className="text-ink-dim">(tri « Potentiel légendaire »)</span>.
          </li>
        </ul>
        <p className="mt-2">
          Le sélecteur <b className="text-ink">Gemme + meule / Meule seule</b> change les courbes de
          potentiel : <b className="text-ink">Gemme + meule</b> = gemme optimale puis meules au max ;{' '}
          <b className="text-ink">Meule seule</b> = on garde les stats actuelles, seules les meules sont
          poussées.
        </p>
        <p className="mt-2">
          👉 Va dans l'onglet <b className="text-ink">Optimisation</b> pour voir{' '}
          <b className="text-ink">quelles runes améliorer</b> et augmenter ton efficience.
        </p>
    </>
  );

  return (
    <div>
      {/* Filtres de la courbe — DANS LA PAGE, aux deux formats.
          ⚠️ **Pas de panneau « Options » ici**, contrairement à l'onglet Liste.
          Descendus dans le tiroir, ils laissaient un écran qui ne porte plus
          qu'un graphe et deux réglages : la page paraît vide, et le bouton
          flottant annonce un contenu qu'on ne devine pas. La Liste, elle, a
          3 000 tuiles à montrer — chaque rangée de filtre lui prend un écran de
          résultats, ce qui n'est pas le cas ici. */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Sets : icônes seules (voir SetFilter) */}
        <SetFilter runes={runes} value={sets} onChange={setSets} />

        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter value={slots} onChange={setSlots} />
          <Pastille
            actif={ancientOnly}
            onClick={() => setAncientOnly((v) => !v)}
            className="ml-1"
            libelle="Antiques"
          />
        </div>
      </div>

      {/* Mode gemme + nombre de runes */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Segmented
            value={gemMode}
            onChange={setGemMode}
            options={[
              {
                key: 'gem',
                label: 'Gemme + meule',
                hint: 'Potentiel avec la gemme optimale + les meules',
              },
              {
                key: 'grind',
                label: 'Meule seule',
                hint: 'Potentiel en gardant les stats actuelles (meules seulement)',
              },
            ]}
          />
          <span className="font-mono text-xs text-ink-dim">
            top {Math.min(cap, total)}
            {total > cap && ` sur ${total}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="label">Nb de runes</span>
          <NumberField
            value={limit}
            min={1}
            max={total || 1}
            step={10}
            width="w-14"
            ariaLabel="Nombre de runes"
            onChange={(v) => setLimit(Math.max(1, v ?? 1))}
          />
          <Bouton onClick={() => setLimit(total || 1)} taille="sm" libelle="Tout" />
        </div>
      </div>

      {/* Graphe + bouton d'aide superposé (popup fermable au clic extérieur).
          ⚠️ **Même plafond de largeur et même centrage que la carte du graphe**
          (voir CurveChart) : sans eux, cette boîte débordait la carte au-delà de
          980 px et le bouton d'aide se posait à côté du dessin, pendant que le
          bouton de plein écran restait dans son coin. Les deux commandes doivent
          tomber sur la MÊME verticale. */}
      <div className="relative mx-auto w-full max-w-[980px]">
        {/* ⚠️ L'ANCRE porte la position ET la taille du bouton : `FlottantAuto`
            mesure la place autour d'elle. Un conteneur sans dimensions — avec
            le bouton en `absolute` à l'intérieur — lui aurait fait mesurer un
            point de hauteur nulle, et la bulle serait tombée à côté. */}
        <div ref={helpRef} className="absolute right-2 top-2 z-20">
          {/* ⚠️ `BoutonIcone` de la librairie, plus un `<button>` écrit à la
              main : le libellé, l'état actif, le cadre et la zone tactile sont
              des AXES du composant. La version manuscrite les réécrivait un par
              un — y compris `data-cible-fine` et `cible-tactile`, que la
              librairie pose déjà ensemble. */}
          <BoutonIcone
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            libelle="Comment lire ce graphe ?"
            icone={<HelpCircle size={14} />}
            cadre
            forme="pilule"
            zoneEtendue
            actif={showHelp}
          />

          {/* À la SOURIS : bulle ancrée au bouton.
              ⚠️ `FlottantAuto` et non un `<div absolute>` : il MESURE la place
              autour de son ancre et choisit son côté avant de peindre. La bulle
              écrite à la main s'ouvrait toujours vers le bas — c'est ce qui la
              faisait sortir de l'écran. */}
          <FlottantAuto ouvert={showHelp && !auDoigt} ancre={helpRef} largeur={340} hauteur={420}>
            <div className="text-xs leading-relaxed text-ink-dim">{aide}</div>
          </FlottantAuto>
        </div>

        {/* AU DOIGT : panneau montant. Il monte du bas, se pose AU-DESSUS de la
            barre d'onglets, occupe toute la largeur et défile — tout ce qui
            manquait à la bulle. */}
        <MobileSheet
          ouvert={showHelp && auDoigt}
          onFermer={() => setShowHelp(false)}
          titre="Comment lire ce graphe ?"
        >
          <div className="text-xs leading-relaxed text-ink-dim">{aide}</div>
        </MobileSheet>

        <CurveChart
          series={visible}
          yLabel={metric === 'eff' ? 'Efficience (%)' : 'Score SW'}
          unit={metric === 'eff' ? '%' : ''}
        />
      </div>

      {/* Légende — sous le graphe, en RANGÉE horizontale (les entrées les unes à
          côté des autres, comme les autres légendes de l'app) ; cliquer un nom
          masque/affiche sa courbe. La couleur et le nom, rien d'autre : les
          valeurs (max, médiane) se lisent au survol du graphe — répétées ici,
          elles alourdissaient une zone qui ne sert qu'à identifier et masquer. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {allSeries.map((s) => {
          const off = hidden.has(s.name);
          return (
            <button
              key={s.name}
              onClick={() => toggleHidden(s.name)}
              title={off ? 'Afficher' : 'Masquer'}
              // `min-h-0` : la règle tactile globale porte les boutons à 40 px,
              // ce qui ferait 120 px pour trois lignes de légende. Ici la cible
              // fait toute la LARGEUR de son texte — on ne rate pas, même à
              // 28 px de haut.
              className="flex min-h-0 items-center gap-2 rounded px-1.5 py-1 text-left
                         font-mono text-micro transition-colors hoverable:bg-panel2 sm:text-xs"
            >
              <span
                className="inline-block h-1.5 w-3 flex-none rounded-full transition"
                style={{ background: s.color, opacity: off ? 0.3 : 1 }}
              />
              <span
                className={`truncate font-semibold transition ${
                  off ? 'text-ink-dim line-through' : 'text-ink'
                }`}
              >
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
