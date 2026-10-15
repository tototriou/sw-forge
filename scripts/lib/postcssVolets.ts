import type { AtRule, Plugin } from 'postcss';
import { seuilContenu } from '../../src/lib/volets';

// Écran partagé : le responsive des pages suit la largeur de leur VOLET, pas
// celle de la fenêtre (docs/02-app/transverse/feat-navigation/ecran-partage.md).
//
// ⚠️ **Aucune page n'a été réécrite pour ça.** Chaque règle `@media` de
// largeur que Tailwind émet (`sm:`, `lg:`, `max-lg:`…) est dédoublée :
// - hors d'un volet, elle reste liée à la FENÊTRE — son sélecteur exclut ce
//   qui est dans un volet, et la pleine page ne bouge pas d'un pixel ;
// - dans un volet, une copie `@container volet` la lie à la largeur du
//   CONTENU du volet, ramenée par `seuilContenu` : le seuil devient la largeur
//   de contenu la plus étroite à laquelle il s'applique hors écran partagé.
//
// ⚠️ **La spécificité ne change pas** : l'exclusion passe par `:where()`, qui
// ne compte pour rien. Une règle responsive garde donc face aux autres (un
// `hover:`, un utilitaire de base) le rang qu'elle a sans écran partagé.
//
// Les requêtes qui ne portent pas sur la largeur (pointeur, thème, mouvement
// réduit) ne sont pas touchées : elles restent celles de la fenêtre.

/** L'attribut posé sur le corps de chaque volet, conteneur nommé `volet`. */
export const ATTRIBUT_VOLET = 'data-volet';
const HORS_VOLET = `:where(:not([${ATTRIBUT_VOLET}] *))`;

/** La condition `@container` équivalente à une condition `@media` de largeur, ou `null`. */
export function conditionConteneur(media: string): string | null {
  const p = media.trim();
  const min = /^\(\s*min-width:\s*(\d+)px\s*\)$/.exec(p);
  if (min) return `(min-width: ${seuilContenu(Number(min[1]))}px)`;
  const nonMin = /^not all and \(\s*min-width:\s*(\d+)px\s*\)$/.exec(p);
  if (nonMin) return `not (min-width: ${seuilContenu(Number(nonMin[1]))}px)`;
  return null;
}

/**
 * Un sélecteur qui ne vaut plus DANS un volet. L'exclusion se pose sur le
 * sujet, avant son pseudo-élément (`::placeholder`, `::before`) : après lui,
 * le sélecteur serait invalide. Les classes de Tailwind échappent leurs « : »
 * (`.lg\:flex`) : un caractère échappé n'est jamais un séparateur.
 */
export function horsVolet(selecteur: string): string {
  let profondeur = 0;
  for (let i = 0; i < selecteur.length; i++) {
    const c = selecteur[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '(' || c === '[') profondeur++;
    else if (c === ')' || c === ']') profondeur--;
    else if (c === ':' && selecteur[i + 1] === ':' && profondeur === 0) {
      return selecteur.slice(0, i) + HORS_VOLET + selecteur.slice(i);
    }
  }
  return selecteur + HORS_VOLET;
}

export function postcssVolets(): Plugin {
  return {
    postcssPlugin: 'volets-conteneur',
    OnceExit(racine) {
      const medias: AtRule[] = [];
      racine.walkAtRules('media', (m) => {
        // Seulement le premier niveau : un `@media` imbriqué (un `hoverable:`
        // sous un `lg:`) voyage avec la règle qui le contient.
        if (m.parent?.type === 'root' && conditionConteneur(m.params)) medias.push(m);
      });
      for (const media of medias) {
        const copie = media.clone({ name: 'container', params: `volet ${conditionConteneur(media.params)}` });
        media.walkRules((r) => {
          // Une règle de `@keyframes` n'a pas de sélecteur d'élément.
          if (r.parent?.type === 'atrule' && /keyframes$/.test((r.parent as AtRule).name)) return;
          r.selectors = r.selectors.map(horsVolet);
        });
        media.after(copie);
      }
    },
  };
}
postcssVolets.postcss = true;
