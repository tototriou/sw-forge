import { ReactNode, useState } from 'react';
import { RotateCw, Gauge } from 'lucide-react';
import { ArtifactDetail, GearSet, RelicDetail, RuneDetail } from '../types';
import { computeStats } from '../lib/stats';
import {
  formatRuneEffect,
  formatArtifactMain,
  splitArtifactSub,
  formatRelicMain,
  RARITY_META,
  SET_BONUS,
  RUNE_EFFECT,
  runeEfficiency,
  runeScore,
} from '../lib/effects';
import RuneWheel from './RuneWheel';
import { COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import ArtifactSlots from './ArtifactSlots';
import StatPanel from './StatPanel';
import { RUNE_METRICS, formatRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { artifactScore, artifactEfficiency } from '../lib/artifacts';
import { ZoneCliquable } from '../ui';

type Selected =
  | { kind: 'rune'; i: number }
  | { kind: 'artifact'; i: number }
  | { kind: 'relic' }
  | null;

// Marque « Antique » : A droit, pieds plats, barre centrale = triangle plein
// qui ne touche pas les bords. Intégrée dans la bannière de rareté.
function AncientMark({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="flex-none" aria-hidden="true">
      <g stroke={color} strokeWidth="2.2" strokeLinecap="butt" strokeLinejoin="miter" fill="none">
        <path d="M12 3.5 L4.5 20.5" />
        <path d="M12 3.5 L19.5 20.5" />
        <path d="M8 14.5 H16" />
        <path d="M2.6 20.5 H7" />
        <path d="M17 20.5 H21.4" />
      </g>
      {/* triangle plein central, détaché des bords */}
      <path d="M12 8.8 L14.4 13.4 L9.6 13.4 Z" fill={color} />
    </svg>
  );
}

// Détail d'une rune, façon jeu : stat principale (gros), innée, substats, set.
export function RuneDetailBox({
  rune,
  icone,
  compact,
  cherches,
}: {
  rune: RuneDetail;
  // Image de la rune (cadre du slot + symbole du set), posée à gauche de
  // l'en-tête. Fournie par l'appelant : la carte sert aussi dans un popover où
  // l'image est déjà à côté, sur la tuile qui l'a ouvert.
  icone?: ReactNode;
  // Rendu resserré : corps réduits, interlignes et marges rognés. Le contenu
  // reste le même — c'est la carte du jeu, et elle vaut d'être lue entière ;
  // seule la place qu'elle prend change.
  //
  // ⚠️ **Par défaut, AU DOIGT.** La carte s'ouvre sous une rune du siège ou de
  // la prépa RTA, écrans où elle est déjà le troisième niveau de détail : en
  // pleine taille elle y occupait un demi-écran. Les tuiles de liste passent
  // `true` explicitement, la fiche d'un monstre `false` — un appel explicite
  // l'emporte toujours.
  compact?: boolean;
  // Codes recherchés → la ligne correspondante est surlignée (écho du filtre).
  cherches?: Set<number>;
}) {
  const auDoigt = useMediaQuery(COMPACT);
  const resserre = compact ?? auDoigt;
  const rarity = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const bonus = SET_BONUS[rune.set];
  const ancient = rune.rank > 10;
  const metric = useRuneMetric();
  const metricHint = RUNE_METRICS.find((m) => m.key === metric)?.hint;

  // ── Détail / total, au clic ─────────────────────────────────────────────
  //
  // Le jeu montre « VIT +26 +5 » : la valeur d'origine et ce que la meule a
  // ajouté. C'est ce qu'il faut pour juger une rune — mais pas pour la comparer
  // à un minimum, où seul le TOTAL compte. Un clic bascule donc entre les deux
  // lectures, sur toute la carte.
  //
  // ⚠️ Le total prend la couleur du BONUS (orange), pas celle de la base : il
  // n'est plus la valeur d'origine, et le garder en blanc laisserait croire
  // qu'on lit toujours la base. La couleur dit « ce nombre inclut la meule ».
  const [total, setTotal] = useState(false);
  // Une rune sans aucune meule n'a rien à basculer : les deux lectures y sont
  // identiques, et un clic sans effet se lit comme un défaut.
  const aDeLaMeule = rune.subs.some((s) => (s.grind ?? 0) > 0);

  return (
    // ⚠️ Fond OPAQUE : cette carte s'affiche dans un popover flottant au-dessus
    // de la grille de runes. Un fond translucide laissait voir les tuiles
    // derrière et rendait le détail illisible.
    <ZoneCliquable
      // ⚠️ `imbrique` : la carte est posée DANS un popover lui-même cliquable, et
      // un `<button>` dans un `<button>` est du HTML invalide. Le composant remet
      // alors à la main le focus clavier et l'activation à Entrée/Espace — voir
      // ZoneCliquable.
      // ⚠️ `stopPropagation` : dans ce popover, le clic de la zone environnante
      // referme le flottant. Sans ça, basculer les valeurs fermait le détail
      // qu'on est en train de lire.
      imbrique
      onClick={
        aDeLaMeule
          ? (e) => {
              e.stopPropagation();
              setTotal((v) => !v);
            }
          : undefined
      }
      aria-pressed={aDeLaMeule ? total : undefined}
      title={
        aDeLaMeule
          ? total
            ? 'Voir le détail (valeur d’origine + meule)'
            : 'Voir les valeurs totales, meule comprise'
          : undefined
      }
      className={`rounded-lg border border-border bg-panel2 ${resserre ? 'p-2' : 'p-3'} ${
        aDeLaMeule ? 'cursor-pointer transition hoverable:border-accent' : ''
      }`}
    >
      {/* En-tête : l'image à gauche, la stat principale au centre, la rareté et
          la mesure à droite. ⚠️ Sur une seule ligne en compact : la rareté et
          l'efficience occupaient leur propre bloc en haut à droite, soit deux
          lignes rien que pour elles. */}
      <div className="flex items-start gap-2">
        {icone}
        <div className="min-w-0 flex-1">
          {/* stat principale + innée */}
          <div
            className={`font-black text-ink leading-tight ${resserre ? 'text-sm' : 'text-base'}`}
          >
            {formatRuneEffect(rune.main)}
          </div>
          {rune.innate && (
            <div
              className={`font-semibold text-water leading-tight ${
                resserre ? 'text-micro' : 'text-sm'
              }`}
            >
              {formatRuneEffect(rune.innate)}
            </div>
          )}
        </div>
        <div className="flex flex-none flex-col items-end">
          {/* ⚠️ En compact, la bannière perd son espacement de lettres et se
              resserre : c'est ELLE qui dictait la largeur minimale de la tuile
              (« LÉGENDAIRE » en capitales espacées), donc celle de toute la
              grille. Les couleurs et le mot restent — c'est le vocabulaire du
              jeu —, seule la place qu'ils prennent change. */}
          <span
            className={`inline-flex items-center gap-1 rounded font-bold uppercase ${
              resserre ? 'px-1.5 py-px text-micro' : 'px-2 py-0.5 text-micro tracking-wide'
            }`}
            style={{ background: rarity.bg, color: rarity.color }}
            title={ancient ? 'Rune antique' : undefined}
          >
            {ancient && <AncientMark size={resserre ? 10 : 12} color={rarity.color} />}
            {rarity.label}
          </span>
          {/* Mesure choisie globalement (sélecteur dans la liste des runes et en
              pied de ce panneau) — même couleur dans les deux cas. */}
          <span className="mt-0.5 font-mono text-micro text-ink-dim" title={metricHint}>
            {metric === 'eff' ? 'Efficience' : 'Score SW'}{' '}
            <b className="text-star">
              {formatRuneMetric(metric === 'eff' ? runeEfficiency(rune) : runeScore(rune), metric)}
            </b>
          </span>
        </div>
      </div>
      {/* Substats : base (blanc) + meule (orange) + ↻ si gemme.
          ⚠️ Tout ALIGNÉ À GAUCHE, valeur collée à son libellé — et non la valeur
          poussée au bord droit de la case. C'est le rendu du jeu, et c'est le
          bon : « VIT +26 +5 » se lit d'un bloc, là où une valeur cadrée à droite
          oblige l'œil à traverser du vide sur chaque ligne. */}
      <div
        className={`border-t border-border/40 ${
          resserre ? 'mt-1.5 space-y-px pt-1.5' : 'mt-2 space-y-1 pt-2'
        }`}
      >
        {rune.subs.map((s, i) => {
          const def = RUNE_EFFECT[s.code];
          const label = def ? (def.label.endsWith('%') ? def.label.slice(0, -1) : def.label) : `#${s.code}`;
          const suffix = def?.suffix ?? '';
          const grind = s.grind ?? 0;
          const base = s.value - grind;
          // Ligne recherchée : liseré d'accent + fond léger, comme sur une tuile
          // d'artéfact. Les compensations annulent exactement le liseré, sinon
          // la ligne visée se décale par rapport aux autres.
          const vise = cherches?.has(s.code) ?? false;
          return (
            <div
              key={i}
              className={`flex items-center gap-1 leading-tight ${
                resserre ? 'text-micro' : 'text-xs'
              } ${vise ? '-mx-1 rounded border-l-2 border-accent bg-accent/[0.08] pl-[2px] pr-1' : ''}`}
            >
              {total ? (
                // Cumulé. ⚠️ En ORANGE (la couleur du bonus) dès qu'une meule
                // entre dedans : le nombre n'est plus la valeur d'origine, et le
                // laisser en blanc ferait croire qu'on lit toujours la base.
                <span className={grind > 0 ? 'font-semibold text-orange-400' : 'text-ink'}>
                  {label} {s.value}
                  {suffix}
                </span>
              ) : (
                <>
                  <span className="text-ink">
                    {label} {base}
                    {suffix}
                  </span>
                  {grind > 0 && (
                    <span className="text-orange-400 font-semibold">
                      +{grind}
                      {suffix}
                    </span>
                  )}
                </>
              )}
              {s.enchant && <RotateCw size={11} className="text-orange-400" />}
            </div>
          );
        })}
      </div>
      {/* Bonus de set — comme dans le jeu, en pied de carte. */}
      {bonus && (
        <div
          className={`border-t border-border/40 text-good ${
            resserre ? 'mt-1.5 pt-1.5 text-micro leading-tight' : 'mt-2 pt-2 text-xs'
          }`}
        >
          {bonus.pieces} Set : {bonus.label}
        </div>
      )}
    </ZoneCliquable>
  );
}

// Libellé de la catégorie d'artéfact, pour la ligne du bas. Les noms du JEU :
// **Attribut** et **Type** — `element` / `archetype` ne sont que les clés des
// données com2us et ne doivent pas remonter à l'écran.
const ELEMENT_FR: Record<string, string> = {
  fire: 'Feu', water: 'Eau', wind: 'Vent', light: 'Lumière', dark: 'Ténèbres', unknown: '—',
};
const ARCHETYPE_FR: Record<string, string> = {
  attack: 'Attaque', defense: 'Défense', hp: 'PV', support: 'Support',
};
function artifactTypeLabel(a: ArtifactDetail): string {
  return a.kind === 'element'
    ? `Attribut · ${ELEMENT_FR[a.element ?? 'unknown'] ?? '—'}`
    : `Type · ${ARCHETYPE_FR[a.archetype ?? ''] ?? '—'}`;
}

// Détail d'un artéfact, façon jeu : stat principale (gros) + substats + type.
// ⚠️ Ré-exportée (retiré côté artéfacts — la liste montre désormais les
// substats et leurs procs en clair, le détail n'y ajoutait plus rien) : reste
// nécessaire ICI (la roue montre les artéfacts en petit, sans leurs lignes)
// ET pour BuildCandidateCard.tsx (Optimizer), qui l'utilise telle quelle.
export function ArtifactDetailBox({ artifact }: { artifact: ArtifactDetail }) {
  const rarity = RARITY_META[artifact.rarity] ?? RARITY_META[1];
  // Réglage global (menu ⚙), partagé avec les runes — pas un état local.
  const metric = useRuneMetric();
  return (
    // Fond opaque : carte affichée en popover, au-dessus de la grille.
    <div className="rounded-lg border border-border bg-panel2 p-3 compact:p-2">
      {/* badge de rareté + SCORE, disposés comme sur la fiche du jeu : la
          rareté, et le score juste en dessous.
          ⚠️ Sur UNE ligne au doigt : empilés, ils prenaient deux lignes rien
          que pour eux, dans une carte qui s'ouvre déjà en troisième niveau de
          détail sous un artéfact. Même correction que sur la carte de rune. */}
      <div className="mb-1.5 flex flex-col items-end gap-1
                      compact:mb-1 compact:flex-row compact:items-center compact:justify-end">
        <span
          className="rounded px-2 py-0.5 text-micro font-bold uppercase tracking-wide"
          style={{ background: rarity.bg, color: rarity.color }}
        >
          {rarity.label}
        </span>
        {/* La mesure choisie dans le menu ⚙ — la même que sur les tuiles et que
            pour les runes. L'autre reste en infobulle : les deux sont la même
            somme à un facteur près (spec/compte/calcul-artefacts.md §3). */}
        <span
          className="font-mono text-micro text-ink-dim tabular-nums"
          title={`Score ${artifactScore(artifact)} · efficience ${artifactEfficiency(artifact).toFixed(1)} %`}
        >
          <Gauge size={10} className="inline-block mr-0.5 -mt-0.5" />
          <b className="text-star">
            {metric === 'eff'
              ? `${artifactEfficiency(artifact).toFixed(1)} %`
              : artifactScore(artifact)}
          </b>
        </span>
      </div>
      {/* stat principale */}
      <div className="text-base font-black leading-tight text-ink compact:text-sm">
        {formatArtifactMain(artifact.main)}
      </div>
      {/* Substats, disposés comme dans le JEU : le nombre de PROCS dans une
          pastille à GAUCHE, puis le libellé dont la **valeur est teintée**
          différemment du texte qui l'entoure.
          ⚠️ Les procs sont ce qui sépare un bon artéfact d'un mauvais — deux
          pièces aux mêmes lignes ne valent pas pareil selon où les
          améliorations sont tombées. Sans eux, la fiche n'expliquait pas le
          score affiché juste au-dessus. */}
      <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
        {artifact.subs.map((s, j) => {
          const procs = s.rolls ?? 0;
          const { avant, valeur, apres } = splitArtifactSub(s);
          return (
            <div key={j} className="flex items-start gap-1.5 text-xs leading-snug compact:text-micro">
              {/* Pastille de procs : verte dès qu'une amélioration est tombée,
                  neutre à zéro — on repère les lignes travaillées d'un coup
                  d'œil, sans lire les chiffres. */}
              <span
                className={`mt-px flex-none rounded px-1 font-mono text-micro font-bold tabular-nums ${
                  procs > 0 ? 'bg-good/20 text-good' : 'bg-ink-dim/15 text-ink-dim'
                }`}
                title={`${procs} amélioration${procs > 1 ? 's' : ''} sur cette ligne`}
              >
                {procs}
              </span>
              <span className="flex-1 text-ink-dim">
                {avant}
                {/* La VALEUR se détache du libellé : c'est elle qu'on compare
                    d'un artéfact à l'autre, le texte ne fait que la nommer. */}
                <b className="text-ink">{valeur}</b>
                {apres}
              </span>
              {s.enchant && <RotateCw size={11} className="text-orange-400 mt-0.5 flex-none" />}
            </div>
          );
        })}
      </div>
      {/* type */}
      <div className="mt-2 pt-2 border-t border-border/40 text-xs text-good">
        {artifactTypeLabel(artifact)}
      </div>
    </div>
  );
}

function RelicDetailBox({ relic }: { relic: RelicDetail }) {
  return (
    <div className="rounded-lg border border-border bg-panel/70 p-2.5">
      <div className="text-xs font-bold text-ink">{formatRelicMain(relic.main)}</div>
      {relic.sub && (
        <div className="text-micro text-ink-dim mt-0.5">Effet secondaire · {relic.sub.value}</div>
      )}
    </div>
  );
}

interface Props {
  gear: GearSet;
  // Vitesse de runes VISÉE, quand elle a été saisie à la main et ne correspond
  // plus à cet équipement : on l'affiche en rouge sur la ligne VIT, pour donner
  // directement la valeur à atteindre. `null` quand tout concorde.
  spdCible?: number | null;
}

export default function MonsterGear({ gear, spdCible = null }: Props) {
  const stats = computeStats(gear);
  const [sel, setSel] = useState<Selected>(null);

  const isSel = (s: Selected) =>
    !!sel &&
    !!s &&
    sel.kind === s.kind &&
    (sel.kind === 'relic' || (s as { i: number }).i === (sel as { i: number }).i);
  const toggle = (s: Exclude<Selected, null>) => setSel((cur) => (isSel(s) ? null : s));

  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-2 compact:flex-col">
      {/* Panneau de stats — voir StatPanel.tsx (base+bonus ↔ total au clic,
          largeur fixe pour ne jamais déplacer artéfacts/roue/relique).
          ⚠️ Sur sa PROPRE ligne sous `sm`. À 200 px il occupait plus de la
          moitié des 348 px utiles et poussait la roue à la ligne suivante,
          laissant les artéfacts seuls à côté de lui : l'équipement se lisait en
          trois morceaux séparés, alors qu'on le compare d'un coup d'œil. */}
      <StatPanel stats={stats} spdCible={spdCible} />

      {/* ⚠️ Artéfacts, roue et relique sur UNE SEULE ligne, quelle que soit la
          largeur : ce sont les trois faces d'un même équipement. Séparés, on
          perd la vue d'ensemble qu'on vient chercher. Ils tiennent sur 348 px
          une fois le panneau de stats sorti de la rangée — voir les tailles
          réduites de chaque bloc sous `sm`. */}
      <div className="contents compact:flex compact:w-full compact:items-center compact:justify-center compact:gap-1.5">
      {/* Artéfacts — détail affiché EN LIGNE plus bas (bloc `sel`), pas un
          popover flottant : pas de `renderOverlay` ici.
          ⚠️ **`ArtifactSlots` et non une boucle sur `gear.artifacts`.** Ce
          composant affiche TOUJOURS les deux emplacements (Attribut, Type), et
          grise celui qui est vide. La boucle, elle, ne rendait que les
          artéfacts PRÉSENTS : un monstre sans artéfact de type n'en montrait
          qu'un, sans qu'on sache s'il en manquait un ou si le monstre n'en
          portait qu'un — et sans artéfact du tout, le bloc disparaissait.
          C'est le même composant que l'Optimiseur utilise déjà. */}
      <ArtifactSlots
        artifacts={gear.artifacts}
        isSelected={(_a, i) => isSel({ kind: 'artifact', i })}
        onSelectArtifact={(_a, i) => toggle({ kind: 'artifact', i })}
      />

      {/* Roue de runes — voir RuneWheel.tsx. Le détail au clic reste
          affiché EN LIGNE sous la roue (bloc `sel` plus bas), pas un
          popover flottant : pas de `renderOverlay` ici, juste
          `onSelectRune`/`isSelected` branchés sur le `Selected` local. */}
      {gear.runes.length > 0 && (
        <RuneWheel
          runes={gear.runes}
          isSelected={(_r, i) => isSel({ kind: 'rune', i })}
          onSelectRune={(_r, i) => toggle({ kind: 'rune', i })}
        />
      )}

      {/* Relique à droite.
          ⚠️ La teinte `star` est le code du JEU pour ce qui a de la valeur, pas
          un accent d'interface — d'où le liseré EN PLUS du fond, contre la règle
          du marqueur unique qui vaut pour les états d'interface.
          ⚠️ Resserrée sous `sm` : elle partage la rangée avec les artéfacts et
          la roue, et son rembourrage de 10 px de chaque côté était le plus
          facile à rendre — le contenu, lui, ne se réduit pas. */}
      {gear.relic && (
        <ZoneCliquable
          onClick={() => toggle({ kind: 'relic' })}
          title="Voir la relique"
          aria-pressed={isSel({ kind: 'relic' })}
          className={`rounded-lg border px-2.5 py-2 text-center compact:px-1.5 compact:py-1.5 ${
            isSel({ kind: 'relic' })
              ? 'border-star bg-star/10 ring-1 ring-star/50'
              : 'border-border bg-panel/60 hoverable:border-accent'
          }`}
        >
          <div className="label">Relique</div>
          <div className="mt-0.5 text-xs font-bold text-ink compact:text-micro">
            {formatRelicMain(gear.relic.main)}
          </div>
        </ZoneCliquable>
      )}
      </div>

      {/* Détail de la pièce sélectionnée, sur sa propre ligne */}
      {sel && (
        <div className="w-full max-w-[280px] mx-auto">
          {sel.kind === 'rune' && gear.runes[sel.i] && <RuneDetailBox rune={gear.runes[sel.i]} />}
          {sel.kind === 'artifact' && gear.artifacts[sel.i] && (
            <ArtifactDetailBox artifact={gear.artifacts[sel.i]} />
          )}
          {sel.kind === 'relic' && gear.relic && <RelicDetailBox relic={gear.relic} />}
        </div>
      )}
    </div>
  );
}
