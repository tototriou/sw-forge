import { ReactNode, useRef } from 'react';
import { Ban } from 'lucide-react';
import { ARTIFACT_KINDS, ArtifactDetail } from '../types';
import ArtifactIcon from './ArtifactIcon';
import { COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import { ZoneCliquable } from '../ui';

// Emplacements d'artéfacts — extraits de [MonsterGear.tsx](src/components/MonsterGear.tsx)
// à son deuxième usage (cartes de résultat de l'Optimizer, voir
// BuildCandidateCard.tsx) plutôt que recopiés, même principe que
// [RuneWheel.tsx](src/components/RuneWheel.tsx).
//
// ⚠️ **Toujours 2 emplacements** (Attribut puis Type, voir `ARTIFACT_KINDS`),
// même si le monstre n'en porte qu'un seul ou aucun — un emplacement vide est
// montré grisé (icône `Ban`), pas simplement absent.

const ARTIFACT_FRAME = `${import.meta.env.BASE_URL}artifact-blank.png`;

// Taille de référence (celle de MonsterGear à `scale=1`).
const BASE_FRAME = 58;
// Voir la note d'échelle dans le composant.
const SCALE_MOBILE = 0.72;
const BASE_ICON = 26;
const BASE_BAN_ICON = 22;

export interface ArtifactSlotsProps {
  artifacts: ArtifactDetail[];
  // 1 = taille pleine (MonsterGear) ; plus petit pour une carte compacte.
  // Échelle explicite. ⚠️ Elle REMPLACE l'adaptation mobile automatique (voir
  // le composant), elle ne s'y multiplie pas.
  scale?: number;
  isSelected?: (artifact: ArtifactDetail, index: number) => boolean;
  onSelectArtifact?: (artifact: ArtifactDetail, index: number) => void;
  // Overlay ancré sur CHAQUE artéfact (ex. un `DetailPopover`) — voir
  // RuneWheel.tsx pour le même principe et pourquoi c'est nécessaire
  // (popover flottant vs détail affiché en ligne selon l'appelant).
  renderOverlay?: (
    artifact: ArtifactDetail,
    index: number,
    anchorRef: { current: HTMLElement | null }
  ) => ReactNode;
}

export default function ArtifactSlots({
  artifacts,
  scale,
  isSelected,
  onSelectArtifact,
  renderOverlay,
}: ArtifactSlotsProps) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // ⚠️ **0,72 sous `sm`** — la même échelle que la roue de runes (RuneWheel) :
  // les deux blocs se lisent côte à côte, les réduire inégalement les
  // désaccorderait. Le cadre passe de 58 à 42 px, ce qui laisse les trois blocs
  // d'équipement (artéfacts, roue, relique) sur UNE ligne de 348 px.
  //
  // ⚠️ Une `scale` explicite REMPLACE cette valeur, elle ne s'y multiplie pas —
  // même contrat que `RuneWheel`. La carte de résultat de l'Optimiseur passe
  // déjà 0,45 pour tenir deux cartes par ligne ; multiplier aurait donné 0,32,
  // soit une icône de 8 px où l'artéfact ne se reconnaît plus.
  const petitEcran = useMediaQuery(COMPACT);
  const echelle = scale ?? (petitEcran ? SCALE_MOBILE : 1);
  const frame = Math.round(BASE_FRAME * echelle);
  const iconSize = Math.max(10, Math.round(BASE_ICON * echelle));
  const banSize = Math.max(10, Math.round(BASE_BAN_ICON * echelle));

  return (
    <div className="flex flex-col gap-1.5 compact:gap-1">
      {ARTIFACT_KINDS.map(({ key, label }, slotIdx) => {
        const i = artifacts.findIndex((a) => a.kind === key);
        const a = i >= 0 ? artifacts[i] : null;
        if (!a) {
          return (
            <div
              key={key}
              title={`Aucun artéfact ${label.toLowerCase()} équipé`}
              className="relative inline-flex items-center justify-center rounded opacity-40"
              style={{ width: frame, height: frame }}
            >
              <img src={ARTIFACT_FRAME} className="absolute inset-0 w-full h-full object-contain grayscale" draggable={false} />
              <Ban size={banSize} className="relative text-ink-dim" />
            </div>
          );
        }
        const selected = isSelected?.(a, i) ?? false;
        return (
          <div
            key={key}
            ref={(el) => {
              refs.current[slotIdx] = el;
            }}
            // ⚠️ Le slot ouvert passe devant ses voisins (z-10) : sans ça, un
            // popover ancré ici pourrait être recouvert par l'autre slot ou
            // par la roue de runes juste à côté, tous deux positionnés dans
            // le même contexte d'empilement.
            className={`relative ${selected ? 'z-10' : ''}`}
          >
            {/* ⚠️ Une ZONE et non un bouton : la cible est le cadre de
                l'artéfact lui-même, dont la taille est calculée en pixels. Un
                rembourrage de bouton l'aurait décalé de son emplacement. */}
            <ZoneCliquable
              onClick={() => onSelectArtifact?.(a, i)}
              title={`Voir l'artéfact ${label.toLowerCase()}`}
              // ⚠️ `data-cible-fine` : sans lui, `min-height: 40px` (cibles
              // tactiles, index.css) gagne contre la hauteur fixée ici et
              // étire le cadre — un carré de jeu, pas une cible libre à
              // agrandir. Même cas que SetComboPicker.tsx.
              data-cible-fine
              className="relative inline-flex items-center justify-center rounded"
              style={{ width: frame, height: frame }}
            >
              <img
                src={ARTIFACT_FRAME}
                className={`absolute inset-0 w-full h-full object-contain transition ${
                  selected ? 'brightness-150 drop-shadow-[0_0_6px_rgba(232,196,74,0.9)]' : ''
                }`}
                draggable={false}
              />
              <ArtifactIcon artifact={a} size={iconSize} className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
            </ZoneCliquable>
            {renderOverlay?.(a, i, { current: refs.current[slotIdx] })}
          </div>
        );
      })}
    </div>
  );
}
