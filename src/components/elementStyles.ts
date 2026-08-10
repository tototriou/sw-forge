import { ElementKey } from '../types';

// Style des chips de filtre par élément, **partagé** par le Bestiaire et par la
// box de « Mon compte ».
//
// ⚠️ Ces classes existaient en double, et les deux copies avaient divergé : la
// box gardait un simple `bg-panel2` là où le Bestiaire passait au dégradé de
// l'élément. Deux écrans qui filtrent la même chose montraient donc deux
// surbrillances différentes.
//
// Inactif : bordure et texte à la couleur de l'élément, fond neutre.
// Actif : **teinte légère de l'élément** en fond, texte dans sa version claire.
//
// ⚠️ **Une teinte, pas un aplat plein.** Le fond dégradé saturé qu'on utilisait
// écrasait le libellé et l'icône : sur des chips de 12 px, du texte sombre sur
// rouge ou violet vif devient illisible. La teinte à 25 % suffit largement à
// signaler le filtre posé — c'est la bordure et le texte colorés qui portent
// l'information, le fond ne fait que la confirmer.
//
// `data-[active=true]` plutôt qu'une concaténation conditionnelle : les classes
// restent écrites en entier dans le source, donc visibles du scanner de
// Tailwind, qui ne lit pas les chaînes construites à l'exécution.
export const ELEMENT_FILTER_STYLES: Record<ElementKey, string> = {
  fire: 'border-fire text-fire data-[active=true]:bg-fire/25 data-[active=true]:text-fire-glow',
  water: 'border-water text-water data-[active=true]:bg-water/25 data-[active=true]:text-water-glow',
  wind: 'border-wind text-wind data-[active=true]:bg-wind/25 data-[active=true]:text-wind-glow',
  light: 'border-light text-light data-[active=true]:bg-light/25 data-[active=true]:text-light-glow',
  dark: 'border-dark text-dark data-[active=true]:bg-dark/25 data-[active=true]:text-dark-glow',
  unknown:
    'border-unknown text-unknown data-[active=true]:bg-unknown/25 data-[active=true]:text-unknown-glow',
};
