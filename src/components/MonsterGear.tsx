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
import StatPanel from './StatPanel';
import { RUNE_METRICS, formatRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { artifactScore, artifactEfficiency } from '../lib/artifacts';
import ArtifactFrameIcon from './ArtifactFrameIcon';

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
  compact = false,
  cherches,
}: {
  rune: RuneDetail;
  // Image de la rune (cadre du slot + symbole du set), posée à gauche de
  // l'en-tête. Fournie par l'appelant : la carte sert aussi dans un popover où
  // l'image est déjà à côté, sur la tuile qui l'a ouvert.
  icone?: ReactNode;
  // Rendu resserré pour une TUILE de liste : corps réduits, interlignes et
  // marges rognés. Le contenu reste le même — c'est la carte du jeu, et elle
  // vaut d'être lue entière ; seule la place qu'elle prend change.
  compact?: boolean;
  // Codes recherchés → la ligne correspondante est surlignée (écho du filtre).
  cherches?: Set<number>;
}) {
  const rarity = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const bonus = SET_BONUS[rune.set];
  const ancient = rune.rank > 10;
  const metric = useRuneMetric();
  const metricHint = RUNE_METRICS.find((m) => m.key === metric)?.hint;
  return (
    // ⚠️ Fond OPAQUE : cette carte s'affiche dans un popover flottant au-dessus
    // de la grille de runes. Un fond translucide laissait voir les tuiles
    // derrière et rendait le détail illisible.
    <div className={`rounded-lg border border-border bg-panel2 ${compact ? 'p-2' : 'p-3'}`}>
      {/* En-tête : l'image à gauche, la stat principale au centre, la rareté et
          la mesure à droite. ⚠️ Sur une seule ligne en compact : la rareté et
          l'efficience occupaient leur propre bloc en haut à droite, soit deux
          lignes rien que pour elles. */}
      <div className="flex items-start gap-2">
        {icone}
        <div className="min-w-0 flex-1">
          {/* stat principale + innée */}
          <div
            className={`font-black text-ink leading-tight ${compact ? 'text-[13px]' : 'text-[15px]'}`}
          >
            {formatRuneEffect(rune.main)}
          </div>
          {rune.innate && (
            <div
              className={`font-semibold text-water leading-tight ${
                compact ? 'text-[11px]' : 'text-[13px]'
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
              compact ? 'px-1.5 py-px text-[9.5px]' : 'px-2 py-0.5 text-[10px] tracking-wide'
            }`}
            style={{ background: rarity.bg, color: rarity.color }}
            title={ancient ? 'Rune antique' : undefined}
          >
            {ancient && <AncientMark size={compact ? 10 : 12} color={rarity.color} />}
            {rarity.label}
          </span>
          {/* Mesure choisie globalement (sélecteur dans la liste des runes et en
              pied de ce panneau) — même couleur dans les deux cas. */}
          <span className="mt-0.5 font-mono text-[11px] text-ink-dim" title={metricHint}>
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
          compact ? 'mt-1.5 space-y-px pt-1.5' : 'mt-2 space-y-1 pt-2'
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
                compact ? 'text-[11.5px]' : 'text-[12.5px]'
              } ${vise ? '-mx-1 rounded border-l-2 border-accent bg-accent/[0.08] pl-[2px] pr-1' : ''}`}
            >
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
              {s.enchant && <RotateCw size={11} className="text-orange-400" />}
            </div>
          );
        })}
      </div>
      {/* Bonus de set — comme dans le jeu, en pied de carte. */}
      {bonus && (
        <div
          className={`border-t border-border/40 text-good ${
            compact ? 'mt-1.5 pt-1.5 text-[11px] leading-tight' : 'mt-2 pt-2 text-[12px]'
          }`}
        >
          {bonus.pieces} Set : {bonus.label}
        </div>
      )}
    </div>
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
    <div className="rounded-lg border border-border bg-panel2 p-3">
      {/* badge de rareté + SCORE, disposés comme sur la fiche du jeu : la
          rareté, et le score juste en dessous. */}
      <div className="flex flex-col items-end mb-1.5 gap-1">
        <span
          className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: rarity.bg, color: rarity.color }}
        >
          {rarity.label}
        </span>
        {/* La mesure choisie dans le menu ⚙ — la même que sur les tuiles et que
            pour les runes. L'autre reste en infobulle : les deux sont la même
            somme à un facteur près (spec/compte/calcul-artefacts.md §3). */}
        <span
          className="font-mono text-[11px] text-ink-dim tabular-nums"
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
      <div className="text-[15px] font-black text-ink leading-tight">{formatArtifactMain(artifact.main)}</div>
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
            <div key={j} className="flex items-start gap-1.5 text-[12px] leading-snug">
              {/* Pastille de procs : verte dès qu'une amélioration est tombée,
                  neutre à zéro — on repère les lignes travaillées d'un coup
                  d'œil, sans lire les chiffres. */}
              <span
                className={`mt-px flex-none rounded px-1 font-mono text-[10.5px] font-bold tabular-nums ${
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
      <div className="mt-2 pt-2 border-t border-border/40 text-[12px] text-good">
        {artifactTypeLabel(artifact)}
      </div>
    </div>
  );
}

function RelicDetailBox({ relic }: { relic: RelicDetail }) {
  return (
    <div className="rounded-lg border border-border bg-panel/70 p-2.5">
      <div className="text-[12px] font-bold text-ink">{formatRelicMain(relic.main)}</div>
      {relic.sub && (
        <div className="text-[11px] text-ink-dim mt-0.5">Effet secondaire · {relic.sub.value}</div>
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
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* Panneau de stats — voir StatPanel.tsx (base+bonus ↔ total au clic,
          largeur fixe pour ne jamais déplacer artéfacts/roue/relique). */}
      <StatPanel stats={stats} spdCible={spdCible} />

      {/* Artéfacts — détail affiché EN LIGNE plus bas (bloc `sel`), pas un
          popover flottant : pas de `renderOverlay` ici. */}
      {gear.artifacts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {gear.artifacts.map((a, i) => {
            const selected = isSel({ kind: 'artifact', i });
            return (
              <button
                key={i}
                onClick={() => toggle({ kind: 'artifact', i })}
                title="Voir l'artéfact"
                className="rounded transition"
              >
                <ArtifactFrameIcon artifact={a} size={58} glow={selected} />
              </button>
            );
          })}
        </div>
      )}

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

      {/* Relique à droite */}
      {gear.relic && (
        <button
          onClick={() => toggle({ kind: 'relic' })}
          title="Voir la relique"
          className={`rounded-lg border px-2.5 py-2 text-center transition ${
            isSel({ kind: 'relic' })
              ? 'border-star ring-1 ring-star/50 bg-star/10'
              : 'border-border bg-panel/60 hoverable:border-accent'
          }`}
        >
          <div className="label">Relique</div>
          <div className="text-[12px] font-bold text-ink mt-0.5">{formatRelicMain(gear.relic.main)}</div>
        </button>
      )}
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
