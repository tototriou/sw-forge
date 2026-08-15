import { ReactNode, useRef } from 'react';
import { RuneDetail } from '../types';
import { RARITY_FILTER } from '../lib/effects';
import RuneIcon from './RuneIcon';
import { SPIN } from './RuneSlotIcon';

// Roue de runes « façon jeu » — extraite de [MonsterGear.tsx](src/components/MonsterGear.tsx)
// à son deuxième usage (cartes de résultat de l'Optimizer, voir
// BuildCandidateCard.tsx) plutôt que recopiée, même principe que
// [Segmented.tsx](src/components/Segmented.tsx)/[Switch.tsx](src/components/Switch.tsx).
//
// ⚠️ Paramétrée par `scale` : MonsterGear l'utilise à `scale=1` (taille
// historique, inchangée) pour la fiche pleine (RTA/Siège/Optimizer), et
// BuildCandidateCard à une échelle réduite pour tenir dans une carte de
// résultat. Les décalages (`FRAME_NUDGE`, `SET_OFFSET`, taille de l'icône de
// set) sont calibrés pour `BASE_WHEEL_W` et multipliés par `scale` — seul
// `WHEEL_POS` (des pourcentages) reste indépendant de l'échelle.

const WHEEL_IMG = `${import.meta.env.BASE_URL}rune-wheel.png`;
const RUNE_FRAME = `${import.meta.env.BASE_URL}rune-blank.png`;

// Taille de référence (ratio de l'image 219×249) — celle de MonsterGear à
// `scale=1`.
const BASE_WHEEL_W = 208;
const BASE_WHEEL_H = Math.round((BASE_WHEEL_W * 249) / 219);
const BASE_FW = 50; // largeur du cadre de rune posé dans un slot
const BASE_FH = 63; // hauteur du cadre de rune
const BASE_SET_ICON = 30;

// Centre de chaque slot sur l'image de la roue (mesuré sur rune-wheel.png, en
// %) — résolution-indépendant, ne dépend pas de `scale`.
// 1 haut, 2 haut-droite, 3 bas-droite, 4 bas, 5 bas-gauche, 6 haut-gauche.
const WHEEL_POS: Record<number, { left: string; top: string }> = {
  1: { left: '49.9%', top: '23.5%' },
  2: { left: '74.8%', top: '36.3%' },
  3: { left: '75.1%', top: '61.7%' },
  4: { left: '49.2%', top: '74.8%' },
  5: { left: '24.6%', top: '61.8%' },
  6: { left: '24.6%', top: '36.2%' },
};

// Petit décalage de position du cadre par slot (px À scale=1), pour bien
// l'asseoir dans son pétale. Le slot 1 est déjà calé. x>0 = vers la droite,
// y>0 = vers le bas.
const FRAME_NUDGE: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 3, y: 0 },
  3: { x: 2, y: 2 },
  4: { x: 2, y: 3 },
  5: { x: -2, y: 2 },
  6: { x: -2, y: 1 },
};

// Décalage de l'icône de set vers le CENTRE de la roue (px à scale=1), pour
// qu'elle paraisse glissée dans le pétale plutôt que posée dessus.
const SET_OFFSET: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 8 },
  2: { x: -7, y: 4 },
  3: { x: -7, y: -4 },
  4: { x: 0, y: -8 },
  5: { x: 7, y: -4 },
  6: { x: 7, y: 4 },
};

export interface RuneWheelProps {
  runes: RuneDetail[];
  // 1 = taille pleine (MonsterGear à scale=1) ; plus petit pour une carte
  // compacte (voir BuildCandidateCard.tsx).
  scale?: number;
  isSelected?: (rune: RuneDetail, index: number) => boolean;
  onSelectRune?: (rune: RuneDetail, index: number) => void;
  // Overlay ancré sur CHAQUE rune (ex. un `DetailPopover`) — reçoit une ref
  // stable vers le cadre de la rune pour s'y positionner. Sans ce prop, un
  // clic se contente d'appeler `onSelectRune` : c'est à l'appelant de montrer
  // le détail ailleurs (MonsterGear l'affiche en ligne sous la roue).
  renderOverlay?: (rune: RuneDetail, index: number, anchorRef: { current: HTMLElement | null }) => ReactNode;
}

export default function RuneWheel({ runes, scale = 1, isSelected, onSelectRune, renderOverlay }: RuneWheelProps) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const wheelW = Math.round(BASE_WHEEL_W * scale);
  const wheelH = Math.round(BASE_WHEEL_H * scale);
  const fw = Math.round(BASE_FW * scale);
  const fh = Math.round(BASE_FH * scale);
  const setIconSize = Math.max(10, Math.round(BASE_SET_ICON * scale));

  return (
    <div
      className="relative flex-none bg-no-repeat bg-center bg-contain"
      style={{ width: wheelW, height: wheelH, backgroundImage: `url(${WHEEL_IMG})` }}
    >
      {runes.map((r, i) => {
        const pos = WHEEL_POS[r.slot] ?? { left: '50%', top: '50%' };
        const rot = ((r.slot - 1) % 6) * 60; // cadre orienté pour le slot 1 → +60°/slot
        const selected = isSelected?.(r, i) ?? false;
        const ancient = r.rank > 10;
        const nudge = FRAME_NUDGE[r.slot] ?? { x: 0, y: 0 };
        const setOff = SET_OFFSET[r.slot] ?? { x: 0, y: 0 };
        return (
          <div
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            // ⚠️ La rune ouverte passe devant ses 5 voisines (z-10) : sans
            // ça, son popover pouvait être recouvert par le cadre d'une rune
            // rendue plus tard dans la roue (même contexte d'empilement,
            // ordre du DOM sinon).
            className={`absolute ${selected ? 'z-10' : ''}`}
            style={{
              left: pos.left,
              top: pos.top,
              width: fw,
              height: fh,
              transform: `translate(calc(-50% + ${nudge.x * scale}px), calc(-50% + ${nudge.y * scale}px))`,
            }}
          >
            <button
              type="button"
              onClick={() => onSelectRune?.(r, i)}
              title={`Slot ${r.slot}${ancient ? ' · antique' : ''} · voir le détail`}
              className="absolute inset-0"
            >
              {/* cadre de rune, tourné pour épouser le slot — runes antiques →
                  halo blanc épousant la forme du losange (drop-shadow). */}
              <img
                src={RUNE_FRAME}
                draggable={false}
                className="absolute inset-0 w-full h-full transition duration-300 ease-out"
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
              {/* icône de set, décalée vers le centre (glissée dans le pétale) */}
              <span
                className={`absolute inset-0 flex items-center justify-center ${SPIN}`}
                style={{ transform: `translate(${setOff.x * scale}px, ${setOff.y * scale}px)` }}
              >
                <RuneIcon setKey={r.set} size={setIconSize} filter={RARITY_FILTER[r.rarity] ?? RARITY_FILTER[1]} />
              </span>
            </button>
            {renderOverlay?.(r, i, { current: refs.current[i] })}
          </div>
        );
      })}
    </div>
  );
}
