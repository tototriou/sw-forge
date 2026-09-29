import { NOM_APP } from '../marque';

// Logo « SW Blacksmith » — l'identité choisie par Thomas (rebranding, R2 bis,
// décisions 24-25) : une enclume surmontée d'un cristal de braise à deux
// facettes et de deux éclats. Redessiné en SVG d'après son image (elle n'existe
// qu'en rendu), validé sur planche (spec/chantiers/rebranding-preuves/
// lot-R2bis-planche.png). Il remplace l'enclume au marteau de la toile.
//
// ⚠️ **Les couleurs sont des JETONS.** L'identité dessine l'enclume en blanc
// sur fond sombre et en noir sur fond clair : c'est `ink`, qui vaut l'un en
// Forge et l'autre en Atelier. Le cristal a ses deux jetons (`logo-cristal`,
// `logo-cristal-clair`, voir index.css).
// ⚠️ `rgb(var(--…))` et non `var(--…)` : les jetons sont des TRIPLETS (voir
// spec/shared/design.md, « Les tokens sont des TRIPLETS »).
//
// Tracés sur une grille de 120 : le symbole occupe x 8-112, y 16-96.
export const TRACES_LOGO = {
  // Plateau épais aux deux pointes, cou court, pied large.
  enclume:
    'M8 58 H112 C106 64 96 69 84 71 C78 72 75 74 75 77 V81 C75 84 78 86 83 88 L86 96 H34 L37 88 C42 86 45 84 45 81 V77 C45 74 42 72 36 71 C24 69 14 64 8 58 Z',
  cristalGauche: 'M60 16 L60 53 L53 40 Z',
  cristalDroite: 'M60 16 L67 40 L60 53 Z',
  eclatGauche: 'M35 34 L53 43.5 L48.5 50.5 Z',
  eclatDroite: 'M85 34 L67 43.5 L71.5 50.5 Z',
};

export function SymboleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <path d={TRACES_LOGO.enclume} fill="rgb(var(--ink))" />
      <path d={TRACES_LOGO.eclatGauche} fill="rgb(var(--ink))" />
      <path d={TRACES_LOGO.eclatDroite} fill="rgb(var(--ink))" />
      <path d={TRACES_LOGO.cristalGauche} fill="rgb(var(--logo-cristal-clair))" />
      <path d={TRACES_LOGO.cristalDroite} fill="rgb(var(--logo-cristal))" />
    </svg>
  );
}

// Le NOM dans la police de l'identité : Saira 700, en capitales espacées
// (choix de Thomas). Il ne sert qu'au nom : les titres restent en Cinzel.
export const CLASSE_NOM = 'font-marque font-bold uppercase tracking-widest';

// Logo HORIZONTAL : le symbole, puis le nom. `replie` : le symbole seul — la
// barre latérale repliée.
// ⚠️ `text-sm` : « SW BLACKSMITH » en capitales espacées mesure 122,7 px en
// 13 px, pour 130 disponibles dans la barre latérale (mesuré en Saira) ; en
// 14 px il en prenait 132 — tronqué.
export default function Logo({ replie = false, tailleSymbole = 'h-7 w-7' }: { replie?: boolean; tailleSymbole?: string }) {
  return (
    <>
      <SymboleLogo className={`${tailleSymbole} flex-none`} />
      {!replie && <span className={`truncate text-sm ${CLASSE_NOM}`}>{NOM_APP}</span>}
    </>
  );
}
