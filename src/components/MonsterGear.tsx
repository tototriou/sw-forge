import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { ArtifactDetail, GearSet, RelicDetail, RuneDetail } from '../types';
import { computeStats } from '../lib/stats';
import {
  formatRuneEffect,
  formatArtifactMain,
  formatArtifactSub,
  formatRelicMain,
  RARITY_META,
  SET_BONUS,
  RUNE_EFFECT,
  runeEfficiency,
  runeScore,
} from '../lib/effects';
import RuneWheel from './RuneWheel';
import ArtifactSlots from './ArtifactSlots';
import StatPanel from './StatPanel';
import { RUNE_METRICS, formatRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';

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
export function RuneDetailBox({ rune }: { rune: RuneDetail }) {
  const rarity = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const bonus = SET_BONUS[rune.set];
  const ancient = rune.rank > 10;
  const metric = useRuneMetric();
  const metricHint = RUNE_METRICS.find((m) => m.key === metric)?.hint;
  return (
    // ⚠️ Fond OPAQUE : cette carte s'affiche dans un popover flottant au-dessus
    // de la grille de runes. Un fond translucide laissait voir les tuiles
    // derrière et rendait le détail illisible.
    <div className="rounded-lg border border-border bg-panel2 p-3">
      {/* badge de rareté (marque « A » antique intégrée) + efficience dessous */}
      <div className="flex flex-col items-end mb-1.5">
        <span
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: rarity.bg, color: rarity.color }}
          title={ancient ? 'Rune antique' : undefined}
        >
          {ancient && <AncientMark size={12} color={rarity.color} />}
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
      {/* stat principale + innée */}
      <div className="text-[15px] font-black text-ink leading-tight">{formatRuneEffect(rune.main)}</div>
      {rune.innate && (
        <div className="text-[13px] font-semibold text-water leading-tight">
          {formatRuneEffect(rune.innate)}
        </div>
      )}
      {/* substats : base (blanc) + meule (orange) + ↻ si gemme */}
      <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
        {rune.subs.map((s, i) => {
          const def = RUNE_EFFECT[s.code];
          const label = def ? (def.label.endsWith('%') ? def.label.slice(0, -1) : def.label) : `#${s.code}`;
          const suffix = def?.suffix ?? '';
          const grind = s.grind ?? 0;
          const base = s.value - grind;
          return (
            <div key={i} className="flex items-center gap-1 text-[12.5px] leading-tight">
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
      {/* bonus de set */}
      {bonus && (
        <div className="mt-2 pt-2 border-t border-border/40 text-[12px] text-good">
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
export function ArtifactDetailBox({ artifact }: { artifact: ArtifactDetail }) {
  const rarity = RARITY_META[artifact.rarity] ?? RARITY_META[1];
  return (
    // Fond opaque : carte affichée en popover, au-dessus de la grille.
    <div className="rounded-lg border border-border bg-panel2 p-3">
      {/* badge de rareté */}
      <div className="flex mb-1.5">
        <span
          className="ml-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: rarity.bg, color: rarity.color }}
        >
          {rarity.label}
        </span>
      </div>
      {/* stat principale */}
      <div className="text-[15px] font-black text-ink leading-tight">{formatArtifactMain(artifact.main)}</div>
      {/* substats (effets conditionnels) : blanc + ↻ orange si modifiée */}
      <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
        {artifact.subs.map((s, j) => (
          <div key={j} className="flex items-start gap-1 text-[12px] text-ink leading-snug">
            <span>{formatArtifactSub(s)}</span>
            {s.enchant && <RotateCw size={11} className="text-orange-400 mt-0.5 flex-none" />}
          </div>
        ))}
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

      {/* Artéfacts — toujours 2 emplacements, voir ArtifactSlots.tsx. Détail
          affiché EN LIGNE plus bas (bloc `sel`), pas un popover flottant :
          pas de `renderOverlay` ici. */}
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
