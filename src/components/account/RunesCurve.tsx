import { useMemo } from 'react';
import { RuneDetail } from '../../types';
import { runePotential } from '../../lib/runeOptim';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import SetFilter from './SetFilter';
import NumberField from '../../ui/NumberField';
import AncientFilter, {
  AncientFilter as AncientFilterValue,
  keepAncient,
  normFiltreAntique,
} from './AncientFilter';
import Bouton from '../../ui/Bouton';
import Segmented from '../../ui/Segmented';
import SlotFilter from './SlotFilter';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';
import CurveLegend from './CurveLegend';
import HelpPopover from '../HelpPopover';

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
  const [ancientBrut, setAncient] = useStickyState<AncientFilterValue>('runesCurve.ancient', 'all');
  const ancient = normFiltreAntique(ancientBrut);
  const [limit, setLimit] = useStickyState('runesCurve.limit', DEFAULT_LIMIT);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCurve.hidden', new Set());
  const [gemMode, setGemMode] = useStickyState<'gem' | 'grind'>('runesCurve.gemMode', 'gem');
  const metric = useRuneMetric(); // réglage global : efficience ou score SW
  const withGem = gemMode === 'gem';

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
      if (!keepAncient(r, ancient)) return false;
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
  }, [runes, sets, slots, ancient, withGem, metric]);

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

  // Le texte d'aide, passé à HelpPopover (bulle à la souris, panneau montant au
  // doigt). Le titre est rendu par HelpPopover, pas répété ici.
  const aide = (
    <>
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
          <AncientFilter value={ancient} onChange={setAncient} />
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

      {/* Graphe + bouton d'aide superposé.
          ⚠️ **Même plafond de largeur et même centrage que la carte du graphe**
          (voir CurveChart) : sans eux, cette boîte débordait la carte au-delà de
          980 px et le bouton d'aide se posait à côté du dessin, pendant que le
          bouton de plein écran restait dans son coin. Les deux commandes doivent
          tomber sur la MÊME verticale. */}
      <div className="relative mx-auto w-full max-w-[980px]">
        {/* Aide « ? » posée sur le coin du graphe — bulle à la souris, panneau
            montant au doigt (voir HelpPopover). Le wrapper `absolute` la cale sur
            la même verticale que le bouton de plein écran de CurveChart. Libellé
            du bouton et titre du panneau diffèrent volontairement. */}
        <div className="absolute right-2 top-2 z-20">
          <HelpPopover title="À quoi sert ce graphe ?" ariaLabel="Comment lire ce graphe ?">
            {aide}
          </HelpPopover>
        </div>

        <CurveChart
          series={visible}
          yLabel={metric === 'eff' ? 'Efficience (%)' : 'Score SW'}
          unit={metric === 'eff' ? '%' : ''}
        />
      </div>

      {/* Légende partagée avec l'onglet Comparaison (voir CurveLegend) — sous le
          graphe, en rangée : la couleur et le nom, rien d'autre. Les valeurs
          (max, médiane) se lisent au survol du graphe ; répétées ici, elles
          alourdissaient une zone qui ne sert qu'à identifier et masquer. Aucune
          courbe ne se retire ici (potentiels et « Moi » sont calculés). */}
      <CurveLegend
        entrees={allSeries.map((s) => ({ name: s.name, color: s.color }))}
        masquees={hidden}
        onBascule={toggleHidden}
      />
    </div>
  );
}
