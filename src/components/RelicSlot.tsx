import { ReactNode, useRef } from 'react';
import { Ban } from 'lucide-react';
import { RelicDetail } from '../types';
import { formatRelicMain, formatRelicUnique } from '../lib/effects';
import { ZoneCliquable } from '../ui';

// Emplacement « Relique » — extrait de [MonsterGear.tsx](src/components/MonsterGear.tsx)
// à son deuxième usage (carte candidat de l'Optimizer, voir
// [BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx)) plutôt
// que recopié, même principe que [ArtifactSlots.tsx](src/components/ArtifactSlots.tsx)
// et [RuneWheel.tsx](src/components/RuneWheel.tsx) (implementation-relique, B.5c bis).
//
// ⚠️ **Emplacement TOUJOURS affiché**, jamais absent : grisé « aucune » sans
// relique (équipement fixe), grisé « en attente » tant que la file n'a pas
// résolu ce build — même principe que `ArtifactSlots` (toujours 2 emplacements)
// et la roue de runes (toujours rendue, même à 0 rune).

// ⚠️ `encadre=false` dans un `Flottant`, qui pose déjà bord + fond + coins
// arrondis — voir `PieceDetailBox`, même règle.
export function RelicDetailBox({ relic, encadre = true }: { relic: RelicDetail; encadre?: boolean }) {
  return (
    <div className={encadre ? 'rounded-lg border border-border bg-panel/70 p-2.5' : ''}>
      <div className="text-xs font-bold text-ink">{formatRelicMain(relic.main)}</div>
      {/* ⚠️ **La description seule, sans intitulé.** La propriété unique
          déclenche un effet proportionnel à une stat (« +2 % par tranche de
          27 000 PV »), et cette phrase se suffit : la coiffer d'un « Propriété
          unique · » répétait une catégorie que la ligne dit déjà, sur deux
          lignes de tuile qui en valent l'or.
          ⚠️ L'export ne dit NULLE PART ce que l'effet fait — seulement un numéro
          de type, qui reste en infobulle pour retrouver la pièce en jeu. */}
      {relic.unique && (
        <div
          className="text-micro text-ink-dim mt-0.5"
          title={`Propriété unique n° ${relic.unique.type} — l'export ne dit pas ce qu'elle déclenche`}
        >
          {formatRelicUnique(relic.unique)}
        </div>
      )}
    </div>
  );
}

export interface RelicSlotProps {
  // La relique à afficher dans l'emplacement — `undefined` : case grisée
  // « aucune » (équipement fixe sans relique, comme `MonsterGear`).
  relic: RelicDetail | undefined;
  // La file n'a pas encore résolu ce build (`etatReliqueDuBuild`, relicQueue.ts,
  // implementation-relique B.5c/5c bis) : case grisée « en attente », rien de
  // cliquable — `relic` est alors ignoré (toujours `undefined` en pratique).
  enAttente?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  // Sous la case (implementation-relique, B.5c bis) : « relique sans effet sur
  // ce tri » / « relique équipée exclue par le filtre » — état `resolue` de
  // `etatReliqueDuBuild` seulement.
  marques?: string[];
  // Overlay ancré (flottant à la souris) — `undefined` au doigt, où le détail
  // s'affiche en ligne sous la pièce (même principe qu'`ArtifactSlots`/`RuneWheel`,
  // voir spec/shared/design.md).
  renderOverlay?: (anchorRef: { current: HTMLElement | null }) => ReactNode;
  // Case plus compacte (carte de résultat de l'Optimizer) — REMPLACE
  // l'adaptation `compact:` responsive de la fiche pleine page, elle ne s'y
  // ajoute pas (même contrat que `scale` sur `ArtifactSlots`/`RuneWheel`).
  small?: boolean;
}

export default function RelicSlot({
  relic,
  enAttente = false,
  selected = false,
  onToggle,
  marques,
  renderOverlay,
  small = false,
}: RelicSlotProps) {
  const ancre = useRef<HTMLDivElement>(null);
  const taille = small ? 'px-1.5 py-1.5' : 'px-2.5 py-2 compact:px-1.5 compact:py-1.5';
  const texte = small ? 'text-micro' : 'text-xs compact:text-micro';

  if (enAttente) {
    return (
      <div
        title="Relique : en attente"
        className={`rounded-lg border border-border bg-panel/60 text-center opacity-40 ${taille}`}
      >
        <div className="label">Relique</div>
        <div className={`mt-0.5 ${texte} text-ink-dim`}>en attente</div>
      </div>
    );
  }

  if (!relic) {
    return (
      <div
        title="Aucune relique équipée"
        className={`rounded-lg border border-border bg-panel/60 text-center opacity-40 ${taille}`}
      >
        <div className="label">Relique</div>
        <div className="mt-0.5 flex items-center justify-center">
          {small ? (
            <Ban size={13} className="text-ink-dim" />
          ) : (
            <>
              <Ban size={16} className="text-ink-dim compact:hidden" />
              <Ban size={13} className="hidden text-ink-dim compact:block" />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={ancre} className={`relative ${selected ? 'z-10' : ''}`}>
      <ZoneCliquable
        onClick={() => onToggle?.()}
        title="Voir la relique"
        aria-pressed={selected}
        className={`rounded-lg border text-center ${taille} ${
          selected
            ? 'border-star bg-star/10 ring-1 ring-star/50'
            : 'border-border bg-panel/60 hoverable:border-accent'
        }`}
      >
        <div className="label">Relique</div>
        <div className={`mt-0.5 font-bold text-ink ${texte}`}>{formatRelicMain(relic.main)}</div>
      </ZoneCliquable>
      {renderOverlay?.({ current: ancre.current })}
      {marques && marques.length > 0 && (
        <div className="mt-1 max-w-[120px] text-nano leading-tight text-ink-dimmer">{marques.join(' · ')}</div>
      )}
    </div>
  );
}
