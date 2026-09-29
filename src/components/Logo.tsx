import { NOM_APP } from '../marque';

// Logo « SW Blacksmith » — l'enclume, le marteau, les étincelles. Tracés repris
// tels quels de la charte de la toile (planche « Charte », rebranding R2 :
// spec/chantiers/rebranding-blacksmith.md).
//
// ⚠️ **Les couleurs sont des JETONS, pas les hex de la charte.** La charte
// dessine l'enclume en parchemin (#EDE3D1) sur fond sombre, et en noir pour la
// version monochrome. `ink` vaut l'un en Forge et l'autre en Atelier : un seul
// symbole, lisible dans les deux thèmes. Marteau en laiton (`star`),
// étincelles en braise vive (`accent` : un tracé décoratif, pas un contour
// d'état — la braise lisible n'y est pas requise).
// ⚠️ `rgb(var(--…))` et non `var(--…)` : les jetons sont des TRIPLETS (voir
// spec/shared/design.md, « Les tokens sont des TRIPLETS »).
//
// Règles de la charte : taille minimum 24 px pour le symbole, 120 px de large
// pour le logo horizontal ; jamais de logo coloré sur un fond braise.
export function SymboleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <path
        d="M8 48 C20 46 30 44 38 44 H110 V60 H90 C84 60 80 64 80 70 V78 H94 V92 H26 V78 H40 V70 C40 64 36 60 30 60 C20 60 13 56 8 48 Z"
        fill="rgb(var(--ink))"
      />
      <line x1="56" y1="30" x2="92" y2="6" stroke="rgb(var(--star))" strokeWidth="7" strokeLinecap="round" />
      <rect x="39" y="24.5" width="30" height="13" rx="2" transform="rotate(56 54 31)" fill="rgb(var(--star))" />
      <g stroke="rgb(var(--accent))" strokeWidth="4" strokeLinecap="round">
        <line x1="70" y1="36" x2="82" y2="28" />
        <line x1="72" y1="42" x2="88" y2="40" />
        <line x1="66" y1="30" x2="72" y2="18" />
      </g>
    </svg>
  );
}

// Logo HORIZONTAL : le symbole, puis le nom en Cinzel gras (la charte).
// `replie` : le symbole seul — la barre latérale repliée.
// ⚠️ Le nom est en `text-base` et non `text-lg` : « SW Blacksmith » fait 13
// caractères (8 pour « SW Forge »), et en `text-lg` il mesurait 140 px pour
// 130 disponibles dans la barre latérale — tronqué. Mesuré en Cinzel, `text-base`
// gras : 127 px.
export default function Logo({ replie = false, tailleSymbole = 'h-7 w-7' }: { replie?: boolean; tailleSymbole?: string }) {
  return (
    <>
      <SymboleLogo className={`${tailleSymbole} flex-none`} />
      {!replie && <span className="truncate font-display text-base font-bold tracking-wide">{NOM_APP}</span>}
    </>
  );
}
