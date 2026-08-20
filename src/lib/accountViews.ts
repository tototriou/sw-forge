import { Gauge, List, LineChart, GitCompare, Wand2, Hammer, Gem } from 'lucide-react';
import type { AccountSub, AccountView } from '../App';

// Les VUES de chaque inventaire — troisième niveau de navigation.
//
// ⚠️ **Une seule source, partagée par la barre latérale et les sections.**
// Chaque section portait sa propre liste d'onglets (`VIEWS` dans
// RunesSection, une autre dans ArtifactsSection) : les remonter dans la barre
// sans les unifier aurait fait deux listes à tenir d'accord, et un onglet
// ajouté d'un côté serait resté introuvable de l'autre.
//
// ⚠️ L'ordre est celui de la lecture : on arrive sur le **Résumé** (l'état du
// stock), la **Liste** vient ensuite, puis les outils d'analyse.

export interface VueInventaire {
  key: AccountView;
  label: string;
  icon: typeof List;
}

// ⚠️ Les monstres n'ont qu'une vue : la box elle-même. Elle existe quand même
// dans cette table pour que la barre traite les trois inventaires de la même
// façon — un cas particulier « pas de troisième niveau ici » se serait glissé
// partout.
const MONSTRES: VueInventaire[] = [{ key: 'liste', label: 'Ma box', icon: List }];

const RUNES: VueInventaire[] = [
  { key: 'resume', label: 'Résumé', icon: Gauge },
  { key: 'liste', label: 'Liste', icon: List },
  { key: 'courbes', label: 'Courbes', icon: LineChart },
  { key: 'comparaison', label: 'Comparaison', icon: GitCompare },
  { key: 'optimisation', label: 'Optimisation', icon: Wand2 },
  // ⚠️ Ces deux-là ne refont pas l'Optimisation : « quelles runes puis-je
  // améliorer avec ce que j'ai » y est un simple FILTRE, sans quoi il faudrait
  // y réimplémenter potentiels et gains. Ils porteront la question inverse —
  // ce qui MANQUE, et où aller le chercher.
  { key: 'meules', label: 'Meules', icon: Hammer },
  { key: 'gemmes', label: 'Gemmes', icon: Gem },
];

// ⚠️ Pas d'« Optimisation » côté artéfacts, et il n'y en aura pas : il n'existe
// ni meule ni gemme pour eux. Une ligne tombée est définitive, le seul levier
// est de monter la pièce au +15. Voir spec/compte/calcul-artefacts.md.
const ARTEFACTS: VueInventaire[] = [
  { key: 'resume', label: 'Résumé', icon: Gauge },
  { key: 'liste', label: 'Liste', icon: List },
];

export const VUES_INVENTAIRE: Record<AccountSub, VueInventaire[]> = {
  monstres: MONSTRES,
  runes: RUNES,
  artefacts: ARTEFACTS,
};

// Vue par défaut d'un inventaire : la première de sa liste.
//
// ⚠️ Un hash tronqué (`#/compte/runes`) ou une vue inconnue doit retomber ici,
// pas afficher un écran vide. C'est ce que garantit `vueValide` ci-dessous.
export function vueParDefaut(sub: AccountSub): AccountView {
  return VUES_INVENTAIRE[sub][0].key;
}

// La vue demandée si elle existe pour cet inventaire, sinon celle par défaut.
//
// ⚠️ Indispensable au CHANGEMENT d'inventaire : passer des Runes (sur
// « Courbes ») aux Artéfacts, qui n'ont pas de courbes, laissait sinon un écran
// blanc — l'ancienne vue ne correspondait plus à rien.
export function vueValide(sub: AccountSub, vue: AccountView): AccountView {
  return VUES_INVENTAIRE[sub].some((v) => v.key === vue) ? vue : vueParDefaut(sub);
}

// Le hash d'une vue. Une seule fonction pour que la barre, les onglets mobiles
// et les liens directs écrivent exactement la même URL.
export function hashVue(sub: AccountSub, vue: AccountView): string {
  return `#/compte/${sub}/${vue}`;
}
