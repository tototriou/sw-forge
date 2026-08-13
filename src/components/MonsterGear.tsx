import { useState } from 'react';
import { RotateCw, ArrowRight, Ban } from 'lucide-react';
import { ARTIFACT_KINDS, ArtifactDetail, GearSet, RelicDetail, RuneDetail } from '../types';
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
  RARITY_FILTER,
  CAPPED_STATS,
} from '../lib/effects';
import RuneIcon from './RuneIcon';
import ArtifactIcon from './ArtifactIcon';
import { SPIN } from './RuneSlotIcon';
import { RUNE_METRICS, formatRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { displayedTotal, useOvercapDisplay } from '../hooks/useOvercapDisplay';

// Nombres compacts (39051 → « 39 051 »).
function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

// Images du jeu (servies en local) : fond de roue + cadre de rune + cadre d'artéfact.
const WHEEL_IMG = `${import.meta.env.BASE_URL}rune-wheel.png`;
const RUNE_FRAME = `${import.meta.env.BASE_URL}rune-blank.png`;
const ARTIFACT_FRAME = `${import.meta.env.BASE_URL}artifact-blank.png`;

// Taille du conteneur de la roue (ratio de l'image 219×249) et du cadre de rune.
const WHEEL_W = 208;
const WHEEL_H = Math.round((WHEEL_W * 249) / 219); // conserve le ratio de l'image
const FW = 50; // largeur du cadre de rune posé dans un slot
const FH = 63; // hauteur du cadre de rune

// Centre de chaque slot sur l'image de la roue (mesuré sur rune-wheel.png, en %).
// 1 haut, 2 haut-droite, 3 bas-droite, 4 bas, 5 bas-gauche, 6 haut-gauche.
const WHEEL_POS: Record<number, { left: string; top: string }> = {
  1: { left: '49.9%', top: '23.5%' },
  2: { left: '74.8%', top: '36.3%' },
  3: { left: '75.1%', top: '61.7%' },
  4: { left: '49.2%', top: '74.8%' },
  5: { left: '24.6%', top: '61.8%' },
  6: { left: '24.6%', top: '36.2%' },
};

// Petit décalage de position du cadre par slot (px), pour bien l'asseoir dans
// son pétale. Le slot 1 est déjà calé. x>0 = vers la droite, y>0 = vers le bas.
const FRAME_NUDGE: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 3, y: 0 }, // vers la droite
  3: { x: 2, y: 2 }, // dans le sens de sa rotation (bas-droite)
  4: { x: 2, y: 3 }, // descend + un peu à droite
  5: { x: -2, y: 2 }, // dans le sens de sa rotation (bas-gauche)
  6: { x: -2, y: 1 }, // légèrement à gauche
};

// Décalage de l'icône de set vers le CENTRE de la roue (px), pour qu'elle
// paraisse glissée dans le pétale plutôt que posée dessus. Direction = vers le
// centre selon l'angle de chaque slot (magnitude ~8 px).
const SET_OFFSET: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 8 },
  2: { x: -7, y: 4 },
  3: { x: -7, y: -4 },
  4: { x: 0, y: -8 },
  5: { x: 7, y: -4 },
  6: { x: 7, y: 4 },
};

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
  // ⚠️ Bascule base+bonus ↔ total, sur un clic n'importe où dans l'encadré
  // de stats (pas un bouton séparé — l'encadré ENTIER est l'affordance).
  const [showTotal, setShowTotal] = useState(false);
  const showOvercap = useOvercapDisplay();

  const isSel = (s: Selected) =>
    !!sel &&
    !!s &&
    sel.kind === s.kind &&
    (sel.kind === 'relic' || (s as { i: number }).i === (sel as { i: number }).i);
  const toggle = (s: Exclude<Selected, null>) => setSel((cur) => (isSel(s) ? null : s));

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* Colonne gauche : stats — base+bonus (bonus en vert) par défaut, ou
          total (même vert, sauf Taux Crit/RES/Précision au plafond de 100 %
          → rouge) au clic. L'encadré entier est cliquable, pas un bouton à
          part : c'est l'un ou l'autre affichage du même bloc, pas une action
          annexe. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowTotal((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowTotal((v) => !v);
          }
        }}
        title={showTotal ? 'Afficher base + bonus' : 'Afficher le total'}
        aria-pressed={showTotal}
        className="rounded-lg border border-border bg-panel/50 p-3 self-start w-fit cursor-pointer
                   transition hoverable:border-accent"
      >
        <table className="text-[12px]">
          <tbody>
            {stats.map((row) => {
              // ⚠️ Le plafond de 100 % (Taux Crit/RES/Précision) n'a de sens
              // à signaler QUE sur le total : un bonus de +30 % n'est pas
              // « au plafond » en soi, c'est la somme avec la base qui peut
              // l'être.
              const atCap = CAPPED_STATS.has(row.key) && row.total >= 100;
              const greenOrRed = atCap ? 'text-red-500' : 'text-good';
              return (
                <tr key={row.key} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-2 text-ink-dim">{row.label}</td>
                  {showTotal ? (
                    <td
                      colSpan={2}
                      className={`py-1 text-right font-mono font-semibold tabular-nums ${greenOrRed}`}
                    >
                      {fmt(displayedTotal(row.key, row.total, showOvercap))}
                      {row.suffix}
                    </td>
                  ) : (
                    <>
                      <td className="py-1 pr-3 text-right font-mono font-semibold text-ink tabular-nums">
                        {fmt(row.base)}
                        {row.suffix}
                      </td>
                      <td className="py-1 text-left font-mono font-semibold text-good tabular-nums">
                        {row.bonus > 0 ? `+${fmt(row.bonus)}${row.suffix}` : '—'}
                        {/* Objectif de vitesse : ce que les runes doivent donner
                            pour coller à la valeur saisie dans l'ordre de tour. */}
                        {row.key === 'spd' && spdCible != null && spdCible !== row.bonus && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-0.5 text-fire"
                            title={`Il faut ${fmt(spdCible)} de SPD sur les runes pour coller à l'ordre de tour`}
                          >
                            <ArrowRight size={11} className="flex-none" />
                            {fmt(spdCible)}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Artéfacts · roue · relique — TOUJOURS 2 emplacements (Attribut puis
          Type, voir ARTIFACT_KINDS), même quand le monstre n'en porte qu'un
          seul ou aucun : l'emplacement vide est montré comme tel (cadre grisé
          + icône « Ban »), façon jeu (voir la capture de référence), plutôt
          que de simplement disparaître — sinon un monstre à un seul artéfact
          se lit comme « n'a qu'UN emplacement », pas « un des deux est vide ». */}
      <div className="flex flex-col gap-1.5">
        {ARTIFACT_KINDS.map(({ key, label }) => {
          const i = gear.artifacts.findIndex((a) => a.kind === key);
          const a = i >= 0 ? gear.artifacts[i] : null;
          if (!a) {
            return (
              <div
                key={key}
                title={`Aucun artéfact ${label.toLowerCase()} équipé`}
                className="relative inline-flex items-center justify-center rounded opacity-40"
                style={{ width: 58, height: 58 }}
              >
                <img src={ARTIFACT_FRAME} className="absolute inset-0 w-full h-full grayscale" draggable={false} />
                <Ban size={22} className="relative text-ink-dim" />
              </div>
            );
          }
          const selected = isSel({ kind: 'artifact', i });
          return (
            <button
              key={key}
              onClick={() => toggle({ kind: 'artifact', i })}
              title={`Voir l'artéfact ${label.toLowerCase()}`}
              className="relative inline-flex items-center justify-center rounded transition"
              style={{ width: 58, height: 58 }}
            >
              <img
                src={ARTIFACT_FRAME}
                className={`absolute inset-0 w-full h-full transition ${
                  selected ? 'brightness-150 drop-shadow-[0_0_6px_rgba(232,196,74,0.9)]' : ''
                }`}
                draggable={false}
              />
              <ArtifactIcon artifact={a} size={26} className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
            </button>
          );
        })}
      </div>

          {/* Roue : (1) image de la roue en fond · (2) cadre de rune tourné par slot · (3) icône de set */}
          {gear.runes.length > 0 && (
            <div
              className="relative flex-none bg-no-repeat bg-center bg-contain"
              style={{ width: WHEEL_W, height: WHEEL_H, backgroundImage: `url(${WHEEL_IMG})` }}
            >
              {gear.runes.map((r, i) => {
                const pos = WHEEL_POS[r.slot] ?? { left: '50%', top: '50%' };
                const rot = ((r.slot - 1) % 6) * 60; // cadre orienté pour le slot 1 → +60°/slot
                const selected = isSel({ kind: 'rune', i });
                const ancient = r.rank > 10; // runes antiques (class > 10)
                return (
                  <button
                    key={i}
                    onClick={() => toggle({ kind: 'rune', i })}
                    title={`Slot ${r.slot}${ancient ? ' · antique' : ''} · voir le détail`}
                    className="absolute"
                    style={{
                      left: pos.left,
                      top: pos.top,
                      width: FW,
                      height: FH,
                      transform: `translate(calc(-50% + ${(FRAME_NUDGE[r.slot] ?? { x: 0, y: 0 }).x}px), calc(-50% + ${
                        (FRAME_NUDGE[r.slot] ?? { x: 0, y: 0 }).y
                      }px))`,
                    }}
                  >
                    {/* (2) cadre de rune, tourné pour épouser le slot.
                        Runes antiques → halo blanc épousant la forme du losange (drop-shadow). */}
                    <img
                      src={RUNE_FRAME}
                      draggable={false}
                      className={`absolute inset-0 w-full h-full transition duration-300 ease-out`}
                      style={{
                        transform: `rotate(${rot}deg)`,
                        filter:
                          [
                            ancient
                              ? 'drop-shadow(0 0 1px rgba(255,255,255,1)) drop-shadow(0 0 2px rgba(255,255,255,0.9))'
                              : '',
                            selected ? 'brightness(1.5) drop-shadow(0 0 6px rgba(245,130,20,0.95))' : '',
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined,
                      }}
                    />
                    {/* (3) icône de set, droite, décalée vers le centre (glissée dans le pétale) */}
                    <span
                      className={`absolute inset-0 flex items-center justify-center ${SPIN}`}
                      style={{
                        transform: `translate(${(SET_OFFSET[r.slot] ?? { x: 0, y: 0 }).x}px, ${
                          (SET_OFFSET[r.slot] ?? { x: 0, y: 0 }).y
                        }px)`,
                      }}
                    >
                      <RuneIcon setKey={r.set} size={30} filter={RARITY_FILTER[r.rarity] ?? RARITY_FILTER[1]} />
                    </span>
                  </button>
                );
              })}
            </div>
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
