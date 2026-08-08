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
  RARITY_FILTER,
} from '../lib/effects';
import RuneIcon from './RuneIcon';
import ArtifactIcon from './ArtifactIcon';

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
  return (
    <div className="rounded-lg border border-[#6d5a37] bg-gradient-to-b from-[#2a2417] to-[#191510] p-3">
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
        <span className="mt-0.5 font-mono text-[11px] text-ink-dim">
          Efficience <b className="text-star">{runeEfficiency(rune).toFixed(1)}%</b>
        </span>
      </div>
      {/* stat principale + innée */}
      <div className="text-[15px] font-black text-ink leading-tight">{formatRuneEffect(rune.main)}</div>
      {rune.innate && (
        <div className="text-[13px] font-semibold text-sky-300 leading-tight">
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
        <div className="mt-2 pt-2 border-t border-border/40 text-[12px] text-emerald-300">
          {bonus.pieces} Set : {bonus.label}
        </div>
      )}
    </div>
  );
}

// Libellé du type d'artéfact (élément ou archétype), pour la ligne du bas.
const ELEMENT_FR: Record<string, string> = {
  fire: 'Feu', water: 'Eau', wind: 'Vent', light: 'Lumière', dark: 'Ténèbres', unknown: '—',
};
const ARCHETYPE_FR: Record<string, string> = {
  attack: 'Attaque', defense: 'Défense', hp: 'PV', support: 'Support',
};
function artifactTypeLabel(a: ArtifactDetail): string {
  return a.kind === 'element'
    ? `Élément · ${ELEMENT_FR[a.element ?? 'unknown'] ?? '—'}`
    : `Archétype · ${ARCHETYPE_FR[a.archetype ?? ''] ?? '—'}`;
}

// Détail d'un artéfact, façon jeu : stat principale (gros) + substats + type.
export function ArtifactDetailBox({ artifact }: { artifact: ArtifactDetail }) {
  const rarity = RARITY_META[artifact.rarity] ?? RARITY_META[1];
  return (
    <div className="rounded-lg border border-[#6d5a37] bg-gradient-to-b from-[#2a2417] to-[#191510] p-3">
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
      <div className="mt-2 pt-2 border-t border-border/40 text-[12px] text-emerald-300">
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
}

export default function MonsterGear({ gear }: Props) {
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
      {/* Colonne gauche : stats (base blanche / bonus vert) */}
      <div className="rounded-lg border border-border bg-panel/50 p-3 self-start w-fit">
        <table className="text-[12px]">
          <tbody>
            {stats.map((row) => (
              <tr key={row.key} className="border-b border-border/40 last:border-0">
                <td className="py-1 pr-2 text-ink-dim">{row.label}</td>
                <td className="py-1 pr-3 text-right font-mono font-semibold text-ink tabular-nums">
                  {fmt(row.base)}
                  {row.suffix}
                </td>
                <td className="py-1 text-left font-mono font-semibold text-emerald-400 tabular-nums">
                  {row.bonus > 0 ? `+${fmt(row.bonus)}${row.suffix}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Artéfacts · roue · relique — chaque pièce passe à la ligne seulement si pas la place */}
      {gear.artifacts.length > 0 && (
        <div className="flex flex-col gap-1.5">
              {gear.artifacts.map((a, i) => {
                const selected = isSel({ kind: 'artifact', i });
                return (
                  <button
                    key={i}
                    onClick={() => toggle({ kind: 'artifact', i })}
                    title="Voir l'artéfact"
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
                    <ArtifactIcon
                      artifact={a}
                      size={26}
                      className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                    />
                  </button>
                );
              })}
            </div>
          )}

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
                      className="absolute inset-0 w-full h-full transition"
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
                      className="absolute inset-0 flex items-center justify-center"
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
                  : 'border-border bg-panel/60 hover:border-[#4a52a0]'
              }`}
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">Relique</div>
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
